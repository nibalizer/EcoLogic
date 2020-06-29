#!/bin/bash

echo curl -X POST -u "apikey:${apikey}" -F "features=objects" -F "collection_ids=${collection_id}" -F "images_file=@images/cardboard_box.jpg"  "${url}/v4/analyze?version=2019-02-11"

curl -H "Content-Type: application/json" -H "Accept: application/json" \
  -X POST \
  -d '{"type": "Recyclable", "name": "Cardboard", "description": "", "quantity": 1, "location": "", "confidence": 0.87}' \
  localhost:3000/api/resource

curl -H "Content-Type: application/json" -H "Accept: application/json" localhost:3000/api/resource


