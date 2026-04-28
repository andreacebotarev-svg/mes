/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "k446m53gvrufd1n",
    "created": "2026-04-28 10:48:11.625Z",
    "updated": "2026-04-28 10:48:11.625Z",
    "name": "conversations",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "3qb8c7ek",
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
        "id": "wceceb5f",
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
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("k446m53gvrufd1n");

  return dao.deleteCollection(collection);
})
