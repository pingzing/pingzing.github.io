#!/usr/bin/env python
# -*- coding: utf-8 -*- #
from __future__ import unicode_literals

import os
import sys
sys.path.append(os.curdir)
from pelicanconf import *
import pelican_precompress

SITEURL = 'https://www.travelneil.com'
RELATIVE_URLS = False
PLUGINS = [*PLUGINS, pelican_precompress]

FEED_DOMAIN = SITEURL
FEED_RSS = "feeds/all.rss.xml"
FEED_ATOM = 'feeds/all.atom.xml'
CATEGORY_FEED_ATOM = 'feeds/%s.atom.xml'

DELETE_OUTPUT_DIRECTORY = False

# Static Comments
COMMENTS_BASE_URL = "https://travelneil-backend.azurewebsites.net/api"

# Procompress
PRECOMPRESS_ZOPFLI = True

# Following items are often useful when publishing

#GOOGLE_ANALYTICS = ""
