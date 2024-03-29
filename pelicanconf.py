#!/usr/bin/env python
# -*- coding: utf-8 -*- #
import os, sys
plugins_path = os.path.abspath(os.path.join('plugins'))
sys.path.append(plugins_path)

from photos import *
from markdown import *

AUTHOR = 'Neil'
SITENAME = 'Travel Neil'
SITEURL = ''
SITE_DESCRIPTION = 'A blog chronicling my (mis)adventures in travel and programming.'

PATH = 'content'
PAGE_PATHS = ['pages']

TIMEZONE = 'Europe/Helsinki'

DEFAULT_LANG = 'en'
DEFAULT_DATE = 'fs'
DISPLAY_PAGES_ON_MENU = True
DISPLAY_CATEGORIES_ON_MENU = True
PLUGIN_PATHS = ['./plugins']
PLUGINS = ['photos', "pelican-cover-image", "static_comments", "article_teaser"]

# Copy the files in these directories without processing to output
STATIC_PATHS = ['static-html', 'wedding_photos', 'images']
ARTICLE_EXCLUDES = ['static-html'] # Don't try to turn anything in these folders into articles
# Remap locations so that they appear where I want them
EXTRA_PATH_METADATA = {
    'static-html/mlp-timeline.htm': { 'path': 'mlp-timeline.htm' },
    'static-html/wedding.html': { 'path': 'wedding.html' }
}

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

# Blogroll
LINKS = ()

# Social widget
SOCIAL = ()

#Specify theme
THEME = "theme/cebong"

# Customize the Python-Markdown module
MARKDOWN = {
    'extension_configs': {
        'markdown.extensions.codehilite': {'css_class': 'highlight'},
        'markdown.extensions.extra': {},
        'markdown.extensions.meta': {},
        'markdown.extensions.toc': {'permalink': '🔗'},
        'markdown.extensions.attr_list': {},
    },
    'output_format': 'html5',
}

# Pagination
DEFAULT_PAGINATION = False

# Uncomment following line if you want document-relative URLs when developing
RELATIVE_URLS = True

#Plugin Configuration
# Photo Resizer
PHOTO_LIBRARY = ".\\content\\images"
PHOTO_RESIZE_JOBS = 1
PHOTO_WATERMARK = False
PHOTO_EXIF_REMOVE_GPS = True
PHOTO_EXIF_KEEP = True
PHOTO_THUMB = (192, 144, 80)
PHOTO_ARTICLE = (760, 506, 90)

# Cover Image
COVER_IMAGES_PATH = "images"

# Static Comments
COMMENTS_BASE_URL = "http://localhost:7071/api"