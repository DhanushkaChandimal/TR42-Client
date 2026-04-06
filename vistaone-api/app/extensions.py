from flask_marshmallow import Marshmallow
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


ma = Marshmallow()
limiter = Limiter(
    key_func=get_remote_address,
)





