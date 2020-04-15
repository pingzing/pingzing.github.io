#!/usr/bin/env python
# -*- coding: utf-8 -*- #
import os, sys
plugins_path = os.path.abspath(os.path.join('plugins'))
sys.path.append(plugins_path)

from photos import *

AUTHOR = 'Neil'
SITENAME = 'Travel Neil'
SITEURL = ''
SITE_DESCRIPTION = 'A blog chronicling my (mis)adventures in travel and programming.'

PATH = 'content'
PAGE_PATHS = ['pages']

TIMEZONE = 'Europe/Helsinki'

DEFAULT_LANG = 'en'
DEFAULT_DATE = 'fs'
#STATIC_PATHS = ['images', 'thumbnails']
DISPLAY_PAGES_ON_MENU = True
DISPLAY_CATEGORIES_ON_MENU = True
PLUGIN_PATHS = ['./plugins']
PLUGINS = [photos, "pelican-cover-image",]

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

DEFAULT_PAGINATION = False

# Uncomment following line if you want document-relative URLs when developing
RELATIVE_URLS = True

#Plugin Configuration
# Photo Resizer
PHOTO_LIBRARY = ".\\content\\images"
PHOTO_RESIZE_JOBS = 1
PHOTO_WATERMARK = False
PHOTO_EXIF_KEEP = False
PHOTO_EXIF_REMOVE_GPS = True

# Cover Image
COVER_IMAGES_PATH = "images"