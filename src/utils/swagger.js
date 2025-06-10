const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gaming News Aggregator API',
      version: '1.0.0',
      description: 'API for aggregating gaming news and reviews from multiple trusted sources.'
    },
    servers: [
      { url: 'http://localhost:3000' }
    ],
    components: {
      schemas: {
        FeedItem: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            link: { type: 'string' },
            pubDate: { type: 'string', format: 'date-time' },
            image: { type: 'string' }
          }
        }
      }
    },
    paths: {
      '/api/feeds/gamespot/news': {
        get: {
          summary: 'Get GameSpot News Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/gamespot/reviews': {
        get: {
          summary: 'Get GameSpot Reviews Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/polygon': {
        get: {
          summary: 'Get Polygon Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/kotaku': {
        get: {
          summary: 'Get Kotaku Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/eurogamer': {
        get: {
          summary: 'Get Eurogamer Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/pcgamer': {
        get: {
          summary: 'Get PC Gamer Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/feeds/ign/news': {
        get: {
          summary: 'Get IGN News Feed',
          parameters: [
            { name: 'q', in: 'query', description: 'Keyword filter', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/FeedItem' } },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [] // Inline annotations can be added here if needed.
};

const specs = swaggerJsDoc(options);

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
};
