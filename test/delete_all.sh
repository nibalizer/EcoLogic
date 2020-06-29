#!/bin/bash


ids=$(curl -s -H "Content-Type: application/json" -H "Accept: application/json" localhost:3000/api/resource | jq '.[].id' | tr -d '"')

for id in $ids
do
    echo deleting $id
    curl -s -H "Content-Type: application/json" -H "Accept: application/json" -X DELETE "localhost:3000/api/resource/${id}"
done
