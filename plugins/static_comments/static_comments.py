"""
static_comments.py
"""

import logging
import requests
from pelican import signals
from datetime import datetime
from requests.models import Response

logger: logging.Logger = logging.getLogger(__name__)

comments_dict = None

def prepare_comments(pelican):
    base_url: str = pelican.settings.get("COMMENTS_BASE_URL", "")
    if base_url == "":
        logger.error("No COMMENTS_BASE_URL defined. Will be unable to retrieve comment info.")
        return
        
    response: Response = requests.get(f"{base_url}/all")

    try:
        global comments_dict
        comments_dict = response.json()
    except Exception as v:
        logger.error(f"Failed to get comments.", exc_info=v)


def get_comments(generator, content):
    article_slug: str = content.metadata.get('slug')
    global comments_dict
    if article_slug in comments_dict:
        comments = comments_dict[article_slug]
        for c in comments:
            if not '_date_fixed' in c:
                c['_date_fixed'] = True
                c['date'] = datetime.strptime(c['date'], "%Y-%m-%dT%H:%M:%S.%f%z")
        content.comments = comments_dict[article_slug]

def register():
    signals.initialized.connect(prepare_comments)
    signals.article_generator_write_article.connect(get_comments)