using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Collections.Generic;

namespace TravelNeil.Backend
{
    public static class CommentsController
    {
        private static JsonSerializerOptions _camelCaseOptions = new JsonSerializerOptions{
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
            

        [FunctionName("GetCommentsForArticle")]
        public static async Task<IActionResult> GetCommentsForArticle(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "{articleSlug}")] HttpRequest request,
            string articleSlug,
            ILogger logger)
        {
            var tableApi = new Table(logger);
            List<Comment> comments = await tableApi.GetCommentsForArticle(articleSlug);            
            return new OkObjectResult(new CommentsResponse { Comments = comments.ToArray() });
        }

        [FunctionName("GetAllComments")]
        public static async Task<IActionResult> GetAllComments(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "all")] HttpRequest request,
            ILogger logger)
        {
            var tableApi = new Table(logger);
            var allComments = await tableApi.GetAllComments();
            return new OkObjectResult(allComments);
        }        

        [FunctionName("PostComment")]
        public static async Task<IActionResult> PostComment(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "{articleSlug}")] HttpRequest req,
            string articleSlug,
            ILogger logger)
        {            
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var comment = JsonSerializer.Deserialize<Comment>(requestBody, _camelCaseOptions);
            if (String.IsNullOrWhiteSpace(comment.Body)) 
            {
                return new BadRequestObjectResult("Comments must not have a null or whitespace-only body.");
            }
            if (String.IsNullOrWhiteSpace(comment.ArticleSlug))
            {
                return new BadRequestObjectResult("Comments must include an article slug.");
            }
            if (String.IsNullOrWhiteSpace(comment.Poster))
            {
                return new BadRequestObjectResult("Comments must include a poster name.");
            }
            if (comment.ParentComment != null)
            {
                return new BadRequestObjectResult("Only the blog owner may post comment replies.");
            }
            comment.IsOwnerComment = false; // none of that shenanigannery here

            var tableApi = new Table(logger);
            Guid? addedCommentId = await tableApi.AddComment(comment);
            if (addedCommentId == null)
            {
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
            }

            return new CreatedResult(addedCommentId.Value.ToString(), null);
        }

        [FunctionName("PostOwnerComment")]
        public static async Task<IActionResult> PostOwnerComment(
            [HttpTrigger(AuthorizationLevel.Admin, "post", Route = "admin/{articleSlug}")] HttpRequest request,
            string articleSlug,
            ILogger logger)
        {
            string requestBody = await new StreamReader(request.Body).ReadToEndAsync();
            var comment = JsonSerializer.Deserialize<Comment>(requestBody, _camelCaseOptions);
            if (String.IsNullOrWhiteSpace(comment.Body)) 
            {
                return new BadRequestObjectResult("Comments must not have a null or whitespace-only body.");
            }
            if (String.IsNullOrWhiteSpace(comment.ArticleSlug))
            {
                return new BadRequestObjectResult("Comments must include an article slug.");
            }

            comment.Poster = "Neil"; // Because, you know.
            comment.IsOwnerComment = true;

            var tableApi = new Table(logger);
            Guid? addedCommentId = await tableApi.AddComment(comment);
            if (addedCommentId == null)
            {
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
            }

            return new CreatedResult(addedCommentId.Value.ToString(), null);
        }

        [FunctionName("DeleteComment")]
        public static async Task<IActionResult> DeleteComment(
            [HttpTrigger(AuthorizationLevel.Admin, "delete", Route = "{articleSlug}/{commentId}")]HttpRequest req,
            string articleSlug,
            string commentId,
            ILogger logger)
        {
            if (!Guid.TryParse(commentId, out Guid commentIdGuid)) 
            {
                return new BadRequestResult();
            }

            var tableApi = new Table(logger);
            bool success = await tableApi.DeleteComment(articleSlug, commentIdGuid);
            if (!success)
            {
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
            }

            return new OkResult();
        }        
    }
}
