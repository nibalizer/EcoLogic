#!/bin/bash

echo curl -X POST -u "apikey:${apikey}" -F "features=objects" -F "collection_ids=${collection_id}" -F "images_file=@images/cardboard_box.jpg"  "${url}/v4/analyze?version=2019-02-11"
