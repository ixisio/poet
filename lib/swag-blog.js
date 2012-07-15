var
  fs       = require( 'fs' ),
  md       = require( 'node-markdown' ).Markdown,
  yamlFm   = require( './front-matter' ),
  jsonFm   = require( 'json-front-matter' ).parse,
  app, storage, options;

var locals, routeFns, refs, utils;


module.exports = function swag ( _app ) {
  storage = {
    posts            : {},
    tags             : [],
    postsTagged      : {},
    categories       : [],
    postsCategorized : {},
    orderedPosts     : []
  };

  options = {
    postsPerPage : 5,
    posts        : './_posts/',
    metaFormat   : jsonFm.parse,
    routes : {
      post     : '/post/:post',
      postList : '/posts/:page',
      tag      : '/tag/:tag',
      category : '/category/:category'
    }
  };

  app      = _app;
  locals   = require( './swag-blog/locals' )( app, options, storage );
  routeFns = require( './swag-blog/routes' )( options, storage );
  refs     = require( './swag-blog/references' )( options, storage );
  utils    = require( './swag-blog/utils' );

  return exports;
};

exports.set = function set ( o ) {
  Object.keys( o ).forEach(function ( k ) {
    var setting = o[ k ];
    if ( k === 'metaFormat' ) {
      setting = o[ k ] === 'yaml' ? yamlFm : jsonFm;
    }
    if ( k === 'posts' ) {
      setting = utils.appendSlash( o[ k ] );
    }
    options[ k ] = setting;
  });
  return exports;
};

exports.createPostRoute     = createRoute( 'post' );
exports.createPostListRoute = createRoute( 'postList' );
exports.createTagRoute      = createRoute( 'tag' );
exports.createCategoryRoute = createRoute( 'category' );
exports.init = init;

function createRoute ( type ) {
  return function routeGenerator( _route, _view ) {
    options.routes[ type ] = _route = _route || options.routes[ type ];
    app.get( _route, routeFns[ type ]( _view || type ) );
    return exports;
  }
}

function init ( callback ) {
  fs.readdir( options.posts, function ( err, files ) {
    if ( err ) throw err;
    var totalFiles = files.length;
    files.forEach(function ( file ) {
      if ( !file.match( /\.md$/ ) ) { totalFiles--; return; }
      fs.readFile( options.posts + file, 'utf-8', function ( err, data ) {
        var
          t = options.metaFormat( data ),
          fileName = file.replace( /\.md$/, '' );
        storage.posts[ fileName ] = {};
        Object.keys( t.attributes ).forEach(function ( p ) {
          if ( p === 'date' )
            storage.posts[ fileName ][ p ] = new Date( t.attributes[ p ] );
          else
            storage.posts[ fileName ][ p ] = t.attributes[ p ];
        });
        if ( !storage.posts[ fileName ].date ) {
          storage.posts[ fileName ].date = new Date();
        }
        storage.posts[ fileName ].content = md( t.body, true );
        storage.posts[ fileName ].preview = md( t.body.replace(/\n.*/g, ''), true );
        storage.posts[ fileName ].url = options.routes.post.match( /[^\:]*/ )[0] + fileName;
        if ( !--totalFiles ) {
          refs();
          locals();
          callback && callback();
        }
      });
    });
  });
}
