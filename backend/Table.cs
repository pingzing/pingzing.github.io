using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Azure;
using Azure.Data.Tables;
using Ganss.XSS;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace TravelNeil.Backend
{
    public class Table
    {
        private readonly TableServiceClient _client;
        private readonly ILogger _logger;
        private readonly HtmlSanitizer _sanitizer;

        public Table(ILogger logger)
        {
            string? connectionString = Environment.GetEnvironmentVariable("TABLE_CONNECTION_STRING", EnvironmentVariableTarget.Process);
            _client = new TableServiceClient(connectionString);
            _logger = logger;

            // Strip EVERYTHING.
            _sanitizer = new HtmlSanitizer(Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>());
            _sanitizer.KeepChildNodes = true; // keep content, just strip the tags            
        }

        public async Task<Guid?> AddComment(Comment comment)
        {
            try
            {
                var tableClient = _client.GetTableClient(ToTableName(comment.ArticleSlug));
                var createResult = await tableClient.CreateIfNotExistsAsync();

                var commentId = Guid.NewGuid();
                var commentEntity = new CommentEntity
                {
                    ArticleSlug = comment.ArticleSlug,
                    Body = _sanitizer.Sanitize(comment.Body).Replace("\n", "<br>"),
                    Date = comment.Date,
                    Poster = comment.Poster,
                    ParentComment = comment.ParentComment,
                    IsOwnerComment = comment.IsOwnerComment,
                    PartitionKey = ToTableName(comment.ArticleSlug),
                    RowKey = commentId.ToString("N"),
                };
                
                var addResponse = await tableClient.AddEntityAsync(commentEntity);
                if (addResponse.Status != StatusCodes.Status204NoContent)
                {
                    _logger.LogError($"Failed to add comment for article {comment.ArticleSlug}. StatusCode: {addResponse.Status}");
                    return null;
                }

                return commentId;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to add comment for article {comment.ArticleSlug}.", ex);
                return null;
            }
        }

        public async Task<List<Comment>> GetCommentsForArticle(string articleSlug)
        {
            try
            {
                if (!TableExists(ToTableName(articleSlug)))
                {
                    _logger.LogWarning($"Unable to get comments for article {articleSlug}. No article with that slug exists.");
                    return new List<Comment>();
                }

                var tableClient = _client.GetTableClient(ToTableName(articleSlug));

                List<Comment> comments = new List<Comment>();
                await foreach (var entity in tableClient.QueryAsync<CommentEntity>())
                {
                    comments.Add(new Comment
                    {
                        ArticleSlug = entity.ArticleSlug,
                        Body = entity.Body,
                        CommentId = Guid.Parse(entity.RowKey),
                        Date = entity.Date,
                        ParentComment = entity.ParentComment,
                        Poster = entity.Poster,
                        IsOwnerComment = entity.IsOwnerComment,
                    });
                }

                return comments;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to get comments for article {articleSlug}", ex);
                return new List<Comment>();
            }
        }

        public async Task<Dictionary<string, List<Comment>>> GetAllComments()
        {
            try
            {
                Dictionary<string, List<Comment>> allComments = new Dictionary<string, List<Comment>>();

                await foreach (var table in _client.GetTablesAsync())
                {
                    var tableClient = _client.GetTableClient(table.TableName);
                    List<Comment> comments = new List<Comment>();

                    await foreach (var entity in tableClient.QueryAsync<CommentEntity>())
                    {
                        comments.Add(new Comment
                        {
                            ArticleSlug = entity.ArticleSlug,
                            Body = entity.Body,
                            CommentId = Guid.Parse(entity.RowKey),
                            Date = entity.Date,
                            ParentComment = entity.ParentComment,
                            Poster = entity.Poster,
                            IsOwnerComment = entity.IsOwnerComment,
                        });
                    }

                    if (comments.Any())
                    {
                        allComments.Add(comments.First().ArticleSlug, comments);
                    }
                }

                return allComments;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to get all comments.", ex);
                return new Dictionary<string, List<Comment>>();
            }
        }

        public async Task<bool> DeleteComment(string articleSlug, Guid commentId)
        {
            try
            {
                if (!TableExists(ToTableName(articleSlug)))
                {
                    _logger.LogWarning($"Unable to delete comment {commentId} for article {articleSlug}. No article with that slug exists.");
                    return false;
                }

                var tableClient = _client.GetTableClient(ToTableName(articleSlug));
                Response deleteResponse = await tableClient.DeleteEntityAsync(ToTableName(articleSlug), commentId.ToString("N"));
                if (deleteResponse.Status != StatusCodes.Status204NoContent)
                {
                    _logger.LogWarning($"Failed to delete comment {commentId.ToString("N")} on article with ID {articleSlug}. Status: {deleteResponse.Status}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to delete comment {commentId} for article {articleSlug}", ex);
                return false;
            }

        }

        public async Task<bool> EditComment(string articleSlug, Guid commentId, string newBody)
        {
            try
            {
                if (!TableExists(ToTableName(articleSlug)))
                {
                    _logger.LogWarning($"Unable to edit comment {commentId} for article {articleSlug}. No article with that slug exists.");
                    return false;
                }

                var tableClient = _client.GetTableClient(ToTableName(articleSlug));
                
                var existingComment = await tableClient.GetEntityAsync<CommentEntity>(
                    articleSlug, 
                    commentId.ToString("N"), 
                    new[] { nameof(CommentEntity.Body) }
                );                

                var updateResult = await tableClient.UpdateEntityAsync(existingComment.Value, ETag.All);
                if (updateResult.Status != StatusCodes.Status204NoContent)
                {
                    _logger.LogError($"Failed to edit comment {commentId} for article {articleSlug}. Status code: {updateResult.Status}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Failed to edit comment {commentId} for article {articleSlug}", ex);
                return false;
            }

        }

        private bool TableExists(string tableName)
        {
            var tables = _client.GetTables($"TableName eq '{tableName}'");
            if (tables.Count() != 1)
            {
                // There are either zero tables by that name, or more than one. Both are bad!
                _logger.LogError($"When looking for comments for {tableName}, found invalid number of tables: {tables.Count()}.");
                return false;
            }

            return true;
        }

        private static Regex _validTableName = new Regex("[^A-Za-z0-9]");
        private string ToTableName(string articleSlug)
        {
            string sanitizedTableName = _validTableName.Replace(articleSlug, "");
            if(char.IsDigit(sanitizedTableName.First())) 
            {
                // prefix the slug with "t" so that the table name begins with a non-numeric
                sanitizedTableName = $"t{sanitizedTableName}";
            }
            if (sanitizedTableName.Length < 3)
            {
                // Table names must  be at least 3 chars
                sanitizedTableName.PadLeft(3, 't');
            }
            if (sanitizedTableName.Length > 63)
            {
                // Table names must be at MAX 63 chars
                sanitizedTableName = sanitizedTableName.Substring(0, 63);
            }

            return sanitizedTableName;
        }
    }
}