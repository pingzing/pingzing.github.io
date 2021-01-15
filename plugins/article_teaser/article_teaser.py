"""
article_teaser.py
"""

import logging
from pelican import signals

logger: logging.Logger = logging.getLogger(__name__)

def add_article_teaser(generator, content):
    # Get first <p>. Operate under the assumption that nesting isn't allowed.    
    article_body: str = content._content
    opening_p = article_body.index("<p>")
    closing_p = article_body.index("</p>", opening_p)    
    first_paragraph = article_body[opening_p:closing_p + 4]

    # Add it to the content as a "teaser".
    content.teaser = first_paragraph

def register():    
    signals.article_generator_write_article.connect(add_article_teaser)