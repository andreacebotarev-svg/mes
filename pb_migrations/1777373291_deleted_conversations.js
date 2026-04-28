/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("0lcb514r9gd2zar");

  return dao.deleteCollection(collection);
}, (db) => {
  const collection = new Collection({
    "id": "0lcb514r9gd2zar",
    "created": "2026-04-28 10:47:53.139Z",
    "updated": "2026-04-28 10:47:53.139Z",
    "name": "conversations",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "ht6jbqou",
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
        "id": "dlcn2zbk",
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
