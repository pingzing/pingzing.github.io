using System;

namespace TravelNeil.Backend 
{
    public class Comment 
    {
        public Guid? CommentId { get; set; } = null!;
        public string Poster { get; set; } = null!;
        public DateTimeOffset Date { get; set; }
        public string ArticleSlug { get; set; } = null!;
        public Guid? ParentComment { get; set; } = null;
        public string Body { get; set; } = null!;
    }
}