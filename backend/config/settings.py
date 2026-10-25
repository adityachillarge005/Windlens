"""
Django settings for WindLens project.
Production-ready configuration with strict separation between development and production modes.
"""

import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# DEBUG mode: default to True for local development, but in production (DEBUG=False)
# strict security checks are enforced.
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

# Insecure example keys that must NEVER be used as a real production secret
KNOWN_INSECURE_KEYS = {
    'windlens-insecure-dev-key-change-in-production-2026',
    'production-secure-key-windlens-2026-replace-if-needed',
    'change-this-in-production-to-a-secure-random-key',
    'replace-with-a-secure-random-secret-key',
}

_dev_fallback_key = 'windlens-insecure-dev-key-change-in-production-2026'
SECRET_KEY = os.environ.get('SECRET_KEY', '').strip()

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = _dev_fallback_key
    else:
        raise ImproperlyConfigured(
            "CRITICAL: The SECRET_KEY environment variable must be set when running in production (DEBUG=False)."
        )
elif not DEBUG and SECRET_KEY in KNOWN_INSECURE_KEYS:
    raise ImproperlyConfigured(
        "CRITICAL: A fixed example secret key cannot be used as a real production secret. "
        "Generate a strong cryptographic key using: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )

# ALLOWED_HOSTS: In development, allow localhost/127.0.0.1.
# In production, require explicit hostnames without wildcards.
allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '').strip()
if allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_env.split(',') if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '.onrender.com']
else:
    # Safe production default: explicit hostnames only, never wildcard '*'
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'backend', '.onrender.com']

# Render dynamically sets RENDER_EXTERNAL_HOSTNAME (e.g. windlens-4vsk.onrender.com)
render_external_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
if render_external_hostname and render_external_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_external_hostname)

if not DEBUG and '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "CRITICAL: Wildcard '*' in ALLOWED_HOSTS is strictly forbidden in production (DEBUG=False)."
    )

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party apps
    'rest_framework',
    'corsheaders',
    # Local apps
    'analytics.apps.AnalyticsConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-gb'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS configuration:
# In development (DEBUG=True), allow all origins for local convenience if configured.
# In production (DEBUG=False), CORS_ALLOW_ALL_ORIGINS is strictly forbidden and always False.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('true', '1', 'yes')
else:
    if os.environ.get('CORS_ALLOW_ALL_ORIGINS', '').lower() in ('true', '1', 'yes'):
        raise ImproperlyConfigured(
            "CRITICAL: Setting CORS_ALLOW_ALL_ORIGINS=True is strictly forbidden in production (DEBUG=False)."
        )
    CORS_ALLOW_ALL_ORIGINS = False

cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '').strip()
if cors_origins_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
elif not CORS_ALLOW_ALL_ORIGINS:
    # Default explicit origins for local container and dev setups
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'UNAUTHENTICATED_USER': None,
}

if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'].append('rest_framework.renderers.BrowsableAPIRenderer')

# Elexon BMRS API Config
ELEXON_BASE_URL = os.environ.get('ELEXON_BASE_URL', 'https://data.elexon.co.uk/bmrs/api/v1')
DATA_CACHE_DIR = BASE_DIR / 'data_cache'
DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
