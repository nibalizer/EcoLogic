const fs = require('fs');
const VisualRecognitionV4 = require('ibm-watson/visual-recognition/v4');
const { IamAuthenticator } = require('ibm-watson/auth');

const apikey = process.env.VR_APIKEY || '<vr_apikey>'
const url = process.env.VR_URL || '<vr_url>'
const collection_id = process.env.VR_COLLECTION_ID || '<collection_id>'

const visualRecognition = new VisualRecognitionV4({
      version: '2019-02-11',
      authenticator: new IamAuthenticator({
              apikey: apikey 
            }),
      url: url,
});

function analyze(imagePath) {
  const params = {
    imageUrl: [
        imagePath
    ],
    collectionIds: [collection_id],
    features: ['objects'],
  };
  visualRecognition.analyze(params)
    .then(response => {
      console.log(JSON.stringify(response.result, null, 2));
      return response.result
  })
    .catch(err => {
      console.log('error: ', err);
      return {"error": "no work"}
  });
}

module.exports = {
  analyze: analyze
};
