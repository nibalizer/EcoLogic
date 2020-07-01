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
    threshold: 0.3
  };
  return new Promise((resolve, reject) => {
    visualRecognition.analyze(params)
      .then(response => {
        console.log(JSON.stringify(response.result, null, 2));
        resolve(prepareImageReport(response.result.images))
      })
      .catch(err => {
        console.log('error: ', err);
        reject(err)
      });
  });
}

function prepareImageReport(images) {
  if (images && images[0] && images[0].objects && images[0].objects.collections
    && images[0].objects.collections[0] && images[0].objects.collections[0].objects) {
    var objects = images[0].objects.collections[0].objects;
    var imgs = [];
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      imgs.push({
        name: obj.object.replace(/_/g, ' '),
        category: objectCategory(obj.object),
        confidence: objectConfidence(obj.score),
        raw_confidence: obj.score
      })
    }
    return imgs;
  }else {
    return []
  }
}

function objectCategory(object) {
  if (object.includes('styrofoam') || object == 'plastic_bag' || object == 'batteries') {
    return 'Not Recyclable';
  }

  if (object.includes('plastic') || object.includes('cardboard')
    || object.includes('paper') || object.includes('metal') || object.includes('glass')
    || object.includes('leather') || object == 'al_pp_package') {
    return 'Recyclable';
  }

  if (object.includes('fruit') || object.includes('vegetable')
    || object.includes('coffee') || object.includes('gardening')
    || object.includes('poop')) {
    return 'Organic';
  }
  return 'Not Recyclable'
}

function objectConfidence(score) {
  if (score < 0.4) {
    return 'not so sure'
  } else if (score < 0.6) {
    return 'prety sure'
  } else if (score < 0.8) {
    return 'almost sure'
  } else {
    return 'sure'
  }
}

module.exports = {
  analyze: analyze
};
