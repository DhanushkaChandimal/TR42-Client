import logging
import os
import functools
from flask import current_app
from logging.handlers import RotatingFileHandler

def login_setup():

    if not os.path.exists("logs"):
        os.mkdir("logs")

    # Get log level and file name from .env
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_file = os.getenv("LOG_FILE", "logs/client-web.log")
    format_env = os.getenv("FORMAT","%(asctime)s - %(levelname)s - %(name)s - %(message)s")


    log_level_value = getattr(logging, log_level, logging.INFO)
    formatter = logging.Formatter(format_env)


    # Root logger
    logger = logging.getLogger()
    logger.setLevel(log_level_value)

    # Rotating File Handler
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=1024 * 1024 * 10, # 1MB
        backupCount=5
    )

    file_handler.setFormatter(formatter)
    file_handler.setLevel(log_level_value)

    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level_value)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.info("Logging initialized successfully")

def log_function_call(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        current_app.logger.info(f"Entering function: {func.__name__}")
        result = func(*args, **kwargs)
        current_app.logger.info(f"Exiting function: {func.__name__}")
        return result
    return wrapper