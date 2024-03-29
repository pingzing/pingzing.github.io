"""
static_comments.py
"""

import logging
import requests
import dateutil.parser
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
    
    logger.info("Getting all comments from " + base_url)

    try:
        response: Response = requests.get(f"{base_url}/all")
        global comments_dict
        comments_dict = response.json()
    except Exception as v:
        logger.error(f"Failed to get comments. Skipping...")


def add_comments(generator, content):
    global comments_dict
    if comments_dict == None:
        logger.warn("Comments dict is empty, skipping generating static comments.")
        return
    article_slug: str = content.metadata.get('slug')
    if article_slug in comments_dict:
        comments = comments_dict[article_slug]

        # Sort by date, as they come back in arbitrary order
        comments.sort(key=lambda x: x['date'])
        # TODO: Handle comments with a parent. they'll be sorted differently

        # Turn stringy dates into pythony dates TODO: Move this up into prepare_comments
        for c in comments:
            if not '_date_fixed' in c:
                c['_date_fixed'] = True
                c['date'] = dateutil.parser.isoparse(c['date'])
        content.comments = comments_dict[article_slug]

def register():
    signals.initialized.connect(prepare_comments)
    signals.article_generator_write_article.connect(add_comments)