/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("k4f919xh390qiqu");

  return dao.deleteCollection(collection);
}, (db) => {
  const collection = new Collection({
    "id": "k4f919xh390qiqu",
    "created": "2026-04-28 10:41:15.329Z",
    "updated": "2026-04-28 10:41:15.329Z",
    "name": "conversations",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "lbssxjlu",
        "name": "type",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "direct",
            "group"
          ]
        }
      },
      {
        "system": false,
        "id": "0dpn8zta",
        "name": "members",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 99,
          "displayFields": null
        }
      }
    ],
    "indexes": [],
    "listRule": "members.id ?= @request.auth.id",
    "viewRule": "members.id ?= @request.auth.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "members.id ?= @request.auth.id",
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
})
