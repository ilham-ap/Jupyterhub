"""sqlalchemy ORM tools for the state of the constellation of processes"""

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import errno
import json
import socket
import uuid

from tornado import gen
from tornado.httpclient import HTTPRequest, AsyncHTTPClient, HTTPError

from sqlalchemy.types import TypeDecorator, VARCHAR
from sqlalchemy import (
    inspect,
    Column, Integer, String, ForeignKey, Unicode, Binary, Boolean,
)
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import sessionmaker, relationship, backref
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from IPython.utils.py3compat import str_to_unicode

from .utils import random_port, url_path_join, wait_for_server


def new_token(*args, **kwargs):
    """generator for new random tokens
    
    For now, just UUIDs.
    """
    return str_to_unicode(uuid.uuid4().hex)


class JSONDict(TypeDecorator):
    """Represents an immutable structure as a json-encoded string.

    Usage::

        JSONEncodedDict(255)

    """

    impl = VARCHAR

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)

        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value


Base = declarative_base()


class Server(Base):
    """The basic state of a server
    
    connection and cookie info
    """
    __tablename__ = 'servers'
    id = Column(Integer, primary_key=True)
    proto = Column(Unicode, default=u'http')
    ip = Column(Unicode, default=u'localhost')
    port = Column(Integer, default=random_port)
    base_url = Column(Unicode, default=u'/')
    cookie_secret = Column(Binary, default=b'secret')
    cookie_name = Column(Unicode, default=u'cookie')
    
    def __repr__(self):
        return "<Server(%s:%s)>" % (self.ip, self.port)
    
    @property
    def host(self):
        return "{proto}://{ip}:{port}".format(
            proto=self.proto,
            ip=self.ip or '*',
            port=self.port,
        )
    
    @property
    def url(self):
        return "{host}{uri}".format(
            host=self.host,
            uri=self.base_url,
        )
    
    @gen.coroutine
    def wait_up(self, timeout=10):
        """Wait for this server to come up"""
        yield wait_for_server(self.ip or 'localhost', self.port, timeout=timeout)
    
    def is_up(self):
        """Is the server accepting connections?"""
        try:
            socket.create_connection((self.ip or 'localhost', self.port))
        except socket.error as e:
            if e.errno == errno.ECONNREFUSED:
                return True
            else:
                raise
        else:
            return True
        


class Proxy(Base):
    """A configurable-http-proxy instance.
    
    A proxy consists of the API server info and the public-facing server info,
    plus an auth token for configuring the proxy table.
    """
    __tablename__ = 'proxies'
    id = Column(Integer, primary_key=True)
    auth_token = Column(Unicode, default=new_token)
    _public_server_id = Column(Integer, ForeignKey('servers.id'))
    public_server = relationship(Server, primaryjoin=_public_server_id == Server.id)
    _api_server_id = Column(Integer, ForeignKey('servers.id'))
    api_server = relationship(Server, primaryjoin=_api_server_id == Server.id)
    
    def __repr__(self):
        if self.public_server:
            return "<%s %s:%s>" % (
                self.__class__.__name__, self.public_server.ip, self.public_server.port,
            )
        else:
            return "<%s [unconfigured]>" % self.__class__.__name__

    @gen.coroutine
    def add_user(self, user, client=None):
        """Add a user's server to the proxy table."""
        client = client or AsyncHTTPClient()
        
        req = HTTPRequest(url_path_join(
                self.api_server.url,
                user.server.base_url,
            ),
            method="POST",
            headers={'Authorization': 'token {}'.format(self.auth_token)},
            body=json.dumps(dict(
                target=user.server.host,
                user=user.name,
            )),
        )
        
        res = yield client.fetch(req)
    
    @gen.coroutine
    def delete_user(self, user, client=None):
        """Remove a user's server to the proxy table."""
        client = client or AsyncHTTPClient()
        req = HTTPRequest(url_path_join(
                self.api_server.url,
                user.server.base_url,
            ),
            method="DELETE",
            headers={'Authorization': 'token {}'.format(self.auth_token)},
        )
        
        res = yield client.fetch(req)
    
    @gen.coroutine
    def add_all_users(self):
        """Update the proxy table from the database.
        
        Used when loading up a new proxy.
        """
        db = inspect(self).session
        futures = []
        for user in db.query(User):
            if (user.server):
                futures.append(self.add_user(user))
        # wait after submitting them all
        for f in futures:
            yield f


class Hub(Base):
    """Bring it all together at the hub.
    
    The Hub is a server, plus its API path suffix
    
    the api_url is the full URL plus the api_path suffix on the end
    of the server base_url.
    """
    __tablename__ = 'hubs'
    id = Column(Integer, primary_key=True)
    _server_id = Column(Integer, ForeignKey('servers.id'))
    server = relationship(Server, primaryjoin=_server_id == Server.id)
    
    @property
    def api_url(self):
        """return the full API url (with proto://host...)"""
        return url_path_join(self.server.url, 'api')
    
    def __repr__(self):
        if self.server:
            return "<%s %s:%s>" % (
                self.__class__.__name__, self.server.ip, self.server.port,
            )
        else:
            return "<%s [unconfigured]>" % self.__class__.__name__


class User(Base):
    """The User table
    
    Each user has a single server,
    and multiple tokens used for authorization.
    
    API tokens grant access to the Hub's REST API.
    These are used by single-user servers to authenticate requests.
    
    Cookie tokens are used to authenticate browser sessions.
    
    A `state` column contains a JSON dict,
    used for restoring state of a Spawner.
    """
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(Unicode)
    # should we allow multiple servers per user?
    _server_id = Column(Integer, ForeignKey('servers.id'))
    server = relationship(Server, primaryjoin=_server_id == Server.id)
    admin = Column(Boolean, default=False)
    
    api_tokens = relationship("APIToken", backref="user")
    cookie_tokens = relationship("CookieToken", backref="user")
    state = Column(JSONDict)
    spawner = None
    
    def __repr__(self):
        if self.server:
            return "<{cls}({name}@{ip}:{port})>".format(
                cls=self.__class__.__name__,
                name=self.name,
                ip=self.server.ip,
                port=self.server.port,
            )
        else:
            return "<{cls}({name} [unconfigured])>".format(
                cls=self.__class__.__name__,
                name=self.name,
            )
    
    def _new_token(self, cls):
        assert self.id is not None
        return cls(token=new_token(), user_id=self.id)
    
    def new_api_token(self):
        """Return a new API token"""
        return self._new_token(APIToken)
    
    def new_cookie_token(self):
        """Return a new cookie token"""
        return self._new_token(CookieToken)

    @gen.coroutine
    def spawn(self, spawner_class, base_url='/', hub=None, config=None):
        db = inspect(self).session
        if hub is None:
            hub = db.query(Hub).first()
        self.server = Server(
            cookie_name='%s-%s' % (hub.server.cookie_name, self.name),
            cookie_secret=hub.server.cookie_secret,
            base_url=url_path_join(base_url, 'user', self.name),
        )
        db.add(self.server)
        db.commit()

        api_token = self.new_api_token()
        db.add(api_token)
        db.commit()

        spawner = self.spawner = spawner_class(
            config=config,
            user=self,
            hub=hub,
            api_token=api_token.token,
        )
        yield spawner.start()

        # store state
        self.state = spawner.get_state()
        db.commit()
    
        yield self.server.wait_up()
        raise gen.Return(self)

    @gen.coroutine
    def stop(self):
        if self.spawner is None:
            return
        status = yield self.spawner.poll()
        if status is None:
            yield self.spawner.stop()
        self.state = {}
        self.spawner = None
        self.server = None
        inspect(self).session.commit()


class Token(object):
    """Mixin for token tables, since we have two"""
    token = Column(String, primary_key=True)
    @declared_attr
    def user_id(cls):
        return Column(Integer, ForeignKey('users.id'))
    
    def __repr__(self):
        return "<{cls}('{t}', user='{u}')>".format(
            cls=self.__class__.__name__,
            t=self.token,
            u=self.user.name,
        )


class APIToken(Token, Base):
    """An API token"""
    __tablename__ = 'api_tokens'


class CookieToken(Token, Base):
    """A cookie token"""
    __tablename__ = 'cookie_tokens'


def new_session(url="sqlite:///:memory:", **kwargs):
    """Create a new session at url"""
    kwargs.setdefault('connect_args', {'check_same_thread': False})
    kwargs.setdefault('poolclass', StaticPool)
    engine = create_engine(url, **kwargs)
    Session = sessionmaker(bind=engine)
    session = Session()
    Base.metadata.create_all(engine)
    return session


