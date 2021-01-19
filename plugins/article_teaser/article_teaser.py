"""
article_teaser.py
"""

import logging
from typing import Tuple, List, Dict
from pelican import signals

logger: logging.Logger = logging.getLogger(__name__)

def get_header_indices(body: str) -> Dict[str, Tuple[int, int]]:
    tags: List[str] = ["h1", "h2", "h3", "h4", "h5", "h6"]
    indices: Dict[str, Tuple[int, int]] = {}

    for tag in tags:
        open_tag = f"<{tag}>"
        close_tag = f"</{tag}>"
        if tag in body:
            opening_index = body.index(open_tag)
            closing_index = body.index(close_tag, opening_index)
            indices[tag] = (opening_index, closing_index)
        else:
            indices[tag] = None
    
    return indices

def add_article_teaser(generator, content):
    article_body: str = content._content        

    # Get first <p>. Operate under the assumption that nesting isn't allowed.    
    opening_p = article_body.index("<p>")
    closing_p = article_body.index("</p>", opening_p)    
    first_paragraph = article_body[opening_p:closing_p + 4]    

    # Get headers. If any of them occur before the first <p>, prepend them to the teaser.
    headers: Dict[str, Tuple[int, int]] = get_header_indices(article_body)
    earlier_headers = {k:v for (k,v) in headers.items() if v is not None if v[0] < opening_p }
    if earlier_headers:
        earliest_header_key = min(earlier_headers, key=lambda x:x[0])            
        earliest_header_indices = earlier_headers[earliest_header_key]        
        earliest_header = article_body[earliest_header_indices[0]:earliest_header_indices[1] + 5]
        first_paragraph = f"{earliest_header}{first_paragraph}"

    # Add it to the content as a "teaser".
    content.teaser = first_paragraph

def register():    
    signals.article_generator_write_article.connect(add_article_teaser)