require('dotenv').config({silent: true})

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const path = require('path');

const assistant = require('./lib/assistant.js');
const port = process.env.PORT || 3000

const cloudant = require('./lib/cloudant.js');

const wa_context = require('./lib/wa-context.js');

const vr = require('./lib/visual-recognition.js');
const { text } = require('body-parser');

const fb_postUrl = "https://graph.facebook.com/v7.0/me/messages";

const app = express();
app.use(bodyParser.json());

const testConnections = () => {
  const status = {}
  return assistant.session()
    .then(sessionid => {
      status['assistant'] = 'ok';
      return status
    })
    .catch(err => {
      console.error(err);
      status['assistant'] = 'failed';
      return status
    })
    .then(status => {
      return cloudant.info();
    })
    .then(info => {
      status['cloudant'] = 'ok';
      return status
    })
    .catch(err => {
      console.error(err);
      status['cloudant'] = 'failed';
      return status
    })
    .then(status => {
      return wa_context.info();
    })
    .then(info => {
      status['wa-context'] = 'ok';
      return status
    })
    .catch(err => {
      console.error(err);
      status['wa-context'] = 'failed';
      return status
    });
};

const handleError = (res, err) => {
  const status = err.code !== undefined && err.code > 0 ? err.code : 500;
  return res.status(status).json(err);
};
/*
app.get('/', (req, res) => {
  testConnections().then(status => res.json({ status: status }));
});
*/
/**
 * Get a session ID
 *
 * Returns a session ID that can be used in subsequent message API calls.
 */
app.get('/api/session', (req, res) => {
  assistant
    .session()
    .then(sessionid => res.send(sessionid))
    .catch(err => handleError(res, err));
});

/**
 * Post process the response from Watson Assistant
 */
function post_process_assistant(result) {
  if (result.actions) {
    var action = result.actions[0];
    switch (action.name) {
      case 'delet-context':
        console.log("User ended conversation");
        //TODO
        result.delete = true;
      case 'locations':
        console.log("User asked for recycling locations");
        var processed_result = result;
    }
  }
  return Promise.resolve(result)
}

/**
 * Post a messge to Watson Assistant
 *
 * The body must contain:
 * 
 * - Message text
 * - sessionID (previsoulsy obtained by called /api/session)
 */
app.post('/api/message', (req, res) => {
  const text = req.body.text || '';
  const sessionid = req.body.sessionid;
  console.log(req.body)

  wa_context.find(sessionid)
        .then(data => {
          return assistant.message(text, data.context);
        })
        .then(result => {
          return post_process_assistant(result)
        })
        .then(result => {
          return handleSession(result, sessionid);
        })
    .then(new_result => {
      res.json(new_result)
    })
    .catch(err => handleError(res, err));
});

/**
 * Get a list of resources
 *
 * The query string may contain the following qualifiers:
 * 
 * - type
 * - name
 * - userID
 *
 * A list of resource objects will be returned (which can be an empty list)
 */
app.get('/api/resource', (req, res) => {
  const type = req.query.type;
  const name = req.query.name;
  const userID = req.query.userID;
  cloudant
    .find(type, name, userID)
    .then(data => {
      if (data.statusCode != 200) {
        res.sendStatus(data.statusCode)
      } else {
        res.send(data.data)
      }
    })
    .catch(err => handleError(res, err));
});

/**
 * Create a new resource
 *
 * The body must contain:
 * 
 * - type
 * - name
 * - userID
 *
 * The body may also contain:
 * 
 * - description
 * - quantity (which will default to 1 if not included)
 * 
 * The ID and rev of the resource will be returned if successful
 */
let types = ["Not Recyclable", "Recyclable", "Organic", ]
let names = ["Styrofoam", "Plastic bag", "Batteries", "Plastic", "Cardboard", "Paper", "Metal", "Glass", "Leather", "Aluminum/Plastic Packaging", "Fruit", "Vegetable", "Coffee", "Gardening"]

app.post('/api/resource', (req, res) => {
  if (!req.body.type) {
    return res.status(422).json({ errors: "Type of item must be provided"});
  }
  if (!types.includes(req.body.type)) {
    return res.status(422).json({ errors: "Type of item must be one of " + types.toString()});
  }
  if (!req.body.name) {
    return res.status(422).json({ errors: "Name of item must be provided"});
  }
  const type = req.body.type;
  const name = req.body.name;
  const description = req.body.description || '';
  const userID = req.body.userID || '';
  const quantity = req.body.quantity || 1;
  const location = req.body.location || '';
  const confidence = req.body.confidence || '';

  cloudant
    .create(type, name, description, quantity, location, confidence)
    .then(data => {
      if (data.statusCode != 201) {
        res.sendStatus(data.statusCode)
      } else {
        res.send(data.data)
      }
    })
    .catch(err => handleError(res, err));
});

/**
 * Update new resource
 *
 * The body may contain any of the valid attributes, with their new values. Attributes
 * not included will be left unmodified.
 * 
 * The new rev of the resource will be returned if successful
 */

app.patch('/api/resource/:id', (req, res) => {
  const type = req.body.type || '';
  const name = req.body.name || '';
  const description = req.body.description || '';
  const userID = req.body.userID || '';
  const quantity = req.body.quantity || '';
  const location = req.body.location || '';
  const confidence = req.body.confidence || '';

  cloudant
    .update(req.params.id, type, name, description, quantity, location, userID)
    .then(data => {
      if (data.statusCode != 200) {
        res.sendStatus(data.statusCode)
      } else {
        res.send(data.data)
      }
    })
    .catch(err => handleError(res, err));
});

/**
 * Delete a resource
 */
app.delete('/api/resource/:id', (req, res) => {
  cloudant
    .deleteById(req.params.id)
    .then(statusCode => res.sendStatus(statusCode))
    .catch(err => handleError(res, err));
});

function isURLVerificationEvent(mode, token) {
  if (mode !== "subscribe" || token !== process.env.FB_VER_TOKEN) {
    return false;
  }
  return true;
}

function isPageObject(params) {
  if (!(params.object === 'page')) {
   console.log("Does not come from facebook");
   return false;
  }
  console.log("Comes from facebook");
  return true;
}

app.get('/fb', function (req, res) {    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];    if (isURLVerificationEvent(mode, token)) {
        // Responds with the challenge token from the request
        console.log("WEBHOOK VERIFIED");
        res.status(200).send(challenge);
    } else {
        // Responds with ‘403 Forbidden’ if verify tokens do not match
        console.log("WEBHOOK INVALID");
        console.log(req.query);
        res.sendStatus(403);
    }
})

app.post('/fb',  function (req, res) {
  try {
      let body = req.body;
      if (isPageObject(body)) {
        console.log(body);
        
        const sessionId = body.entry[0].messaging[0].sender.id;
        const text = body.entry[0].messaging[0].message.text;
        const attachments = body.entry[0].messaging[0].message.attachments;
        //console.log(sessionId,text,attachments);
        
        wa_context.find(sessionId)
        .then( data => {
          //console.log(data);
          return handleAttachments(attachments, data.doc.context, text)
        })
        .then(data => {
          //console.log(data.context);
          return assistant.message(data.text, data.context);
        })
        .then(result => {
          console.log(JSON.stringify(result));
          return post_process_assistant(result)
        })
        .then(result => {
          console.log(result);
          (async function loop() {
            for (let i = 0; i < result.output.generic.length; i++) {
                const msg = result.output.generic[i];
                await postFacebook(msg, sessionId);
                console.log(i);
            }
        })()
        .catch(err => console.log(err));
        
        return result;
          //for (let i = 0; i < result.generic.length; i++) {
          //  const msg = result.generic[i];
          //  await postFacebook(msg.text, sessionId);
          //}
          //return postFacebook(result, sessionId);
        })
        .then(result => {

          return handleSession(result, sessionId);
        })
        .then(new_result => {
          res.json({
            text: 200, 
            message: new_result
          })
        })
        .catch(err => handleError(res, err));
      }
    }catch (err) {
      console.error('Caught error: ');
      console.log(err);
      res.status(500).send(err)
    }
  })

/**
 *  Poste la respuesta de la convesacion al messenger usando el Facebook API https://graph.facebook.com/v2.6/me/messages
 *
 *  @result  {JSON} Respuesta de Watson
 *  @userid  {string} Id de usuario de facebok
 *
 *  @return - Status del request al POST API
 */
function postFacebook(msg, userid) {
  console.log('Entro a enviar a facebook');

  const facebookParams = {
    recipient: {
      id: userid
    },
    // Get payload for regular text message or interactive message
    message: getMessageType(msg)
  };

  return new Promise(function(resolve, reject){
    request(
      {
        url: fb_postUrl,
        qs: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: facebookParams
      },
      function(error, response)  {
        if (error) {
          //console.log(error);
          return reject(error.message);
        }
        if (response) {
          //console.log(response);
          if (response.statusCode === 200) {
            return resolve(msg);
          }
          return reject(
            `Action returned with status code ${response.statusCode}, message: ${response.statusMessage}`
          );
        }
        reject(`An unexpected error occurred when sending POST to ${postUrl}.`);
      }
    );
  });
}

/**
 * Evalua los mensajes para extraer el payload interactivo o el mensaje de texto
 *
 * @params {JSON} Parametros de la accion
 * @return {JSON} - El archivo adjunto o el mensaje de texto
 */
function getMessageType(msg) {
    
  if(msg.response_type=='search'){
    var textresponse = msg.header + "\n";
    for (let i = 0; i < msg.results.length; i++) {
      const btn = msg.results[i];
      textresponse += btn.title + "\n";
      textresponse += btn.body + "\n"; 
      textresponse += btn.url + "\n";
      textresponse += "\n" + "\n"; 
    }
    
    return { text: textresponse };
  }
  if(msg.response_type=='text'){
    return { text: msg.text };
  }
  return { text: msg.text };
}


function handleAttachments(attachments, context, text){
  //console.log(context);
  
  return new Promise(function(resolve, reject){
    if(attachments && attachments[0].type == 'image'){
      vr.analyze(attachments[0].payload.url)
      .then(result => {
        if(!context.skills){
          context.skills = {};
        }
        if(!context.skills['main skill']){
          context.skills['main skill'] = {};
        }
        if(!context.skills['main skill'].user_defined){
          context.skills['main skill'].user_defined = {};
        }
        context.skills['main skill'].user_defined.images = result;

        for (const img of result) {

          const type = img.category;
          const name = img.name;
          const description = req.body.description || '';
          const quantity = req.body.quantity || 1;
          const location = req.body.location || '';
          const confidence = img.raw_confidence

          cloudant.create(type, name, description, quantity, location, confidence)
        }
        resolve({text: "images", context: context });
      })
    }else{
      resolve({text: text, context : context});
    }
  });
}

function handleSession(result,sessionId){
  if(result.delete){
    "Destroying Context"
    return wa_context.deleteById(sessionId);
  }else{
    console.log("Saving Context");
    return wa_context.update(sessionId, result.context);
  }
}

app.get('/dashboard',function(req,res){
  res.sendFile(path.join(__dirname+'/public/dashboard.html'));
})

app.get('/team',function(req,res){
  res.sendFile(path.join(__dirname+'/public/team.html'));
})

app.get('/privacy',function(req,res){
  res.sendFile(path.join(__dirname+'/public/privacy.html'));
})

app.get('/',function(req,res){
  res.sendFile(path.join(__dirname+'/public/index.html'));
})

app.use(express.static('public'));

const server = app.listen(port, () => {
   const host = server.address().address;
   const port = server.address().port;
   console.log(`EcoLogic: recycle app listening at http://${host}:${port}`);
});

//console.log(vr.analyze("https://ak.picdn.net/shutterstock/videos/1014467753/thumb/6.jpg"));
//console.log(assistant.message('Hi'));
