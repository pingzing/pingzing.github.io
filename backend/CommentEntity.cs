using System;
using Azure;
using Azure.Data.Tables;

namespace TravelNeil.Backend
{
    public class CommentEntity : ITableEntity
    {       
        public string Poster { get; set; } = null!;
        public DateTimeOffset Date { get; set; }
        public string ArticleSlug { get; set; } = null!;
        public Guid? ParentComment { get; set; } = null;
        public string Body { get; set; } = null!;

        public string PartitionKey { get; set; } = null!;
        public string RowKey { get; set; } = null!;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }
    }
}