#!/bin/bash

# Test visual recognition
# echo curl -X POST -u "apikey:${apikey}" -F "features=objects" -F "collection_ids=${collection_id}" -F "images_file=@images/cardboard_box.jpg"  "${url}/v4/analyze?version=2019-02-11"

# Create a recycling event
curl -H "Content-Type: application/json" -H "Accept: application/json" \
  -X POST \
  -d '{"type": "Recyclable", "name": "Cardboard", "description": "", "quantity": 1, "location": "", "confidence": 0.87}' \
  localhost:3000/api/resource

# List all recycling events
curl -H "Content-Type: application/json" -H "Accept: application/json" localhost:3000/api/resource


# Delete a resource
# jcurl -i -d '{"apikey": "hunter2"}'  -X DELETE "localhost:3000/api/resource/be1165f2-7688-4ebf-816f-fe99e981b473"
