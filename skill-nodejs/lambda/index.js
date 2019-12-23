/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
 *
 * You may not use this file except in compliance with the terms and conditions 
 * set forth in the accompanying LICENSE.TXT file.
 *
 * THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
 * RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
*/

// This sample demonstrates sending directives to an Echo connected gadget from an Alexa skill
// using the Alexa Skills Kit SDK (v2). Please visit https://alexa.design/cookbook for additional
// examples on implementing slots, dialog management, session persistence, api calls, and more.

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');

// The audio tag to include background music
const BG_MUSIC = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_waiting_loop_30s_01"/>';

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function(handlerInput) {

        let request = handlerInput.requestEnvelope;
        let { apiEndpoint, apiAccessToken } = request.context.System;
        let apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        if ((apiResponse.endpoints || []).length === 0) {
            return handlerInput.responseBuilder
            .speak(`I couldn't find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
            .getResponse();
        }

        // Store the gadget endpointId to be used in this skill session
        let endpointId = apiResponse.endpoints[0].endpointId || [];
        Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        // Set skill duration to 5 minutes (ten 30-seconds interval)
        Util.putSessionAttribute(handlerInput, 'duration', 10);

        
        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
         Util.putSessionAttribute(handlerInput, 'token', token);

       return handlerInput.responseBuilder
            .speak("Welcome, you can start issuing commands")
            .reprompt("Awaiting commands")
            .getResponse();
          
 
   
    }
};

// Add the speed value to the session attribute.
// This allows other intent handler to use the specified speed value
// without asking the user for input.
const SetSpeedIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetSpeedIntent';
    },
    handle: function (handlerInput) {

        // Bound speed to (1-100)
        let speed = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Speed');
        speed = Math.max(1, Math.min(100, parseInt(speed)));
        Util.putSessionAttribute(handlerInput, 'speed', speed);

        return handlerInput.responseBuilder
            .speak(`speed set to ${speed} percent.`)
            .reprompt("awaiting command")
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with
// data from the MoveIntent request.
const MoveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MoveIntent';
    },
    handle: function (handlerInput) {
        const request = handlerInput.requestEnvelope;
        const direction = Alexa.getSlotValue(request, 'Direction');

        // Duration is optional, use default if not available
        const duration = Alexa.getSlotValue(request, 'Duration') || "2";

        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const speed = attributesManager.getSessionAttributes().speed || "50";
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        const directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'move',
                direction: direction,
                duration: duration,
                speed: speed
            });

        const speechOutput = (direction === "brake")
            ?  "Applying brake"
            : `${direction} ${duration} seconds at ${speed} percent speed`;

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt("awaiting command")
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the SetCommandIntent request.
const SetCommandIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetCommandIntent';
    },
    handle: function (handlerInput) {

        let command = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Command');
        if (!command) {
            return handlerInput.responseBuilder
                .speak(` This command ${command} is not support. Can you repeat that?`)
                .reprompt("What was that again?").getResponse();
        }

        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let speed = attributesManager.getSessionAttributes().speed || "50";
        let token = attributesManager.getSessionAttributes().token;
        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'command',
                command: command,
                speed: speed
            });

        return handlerInput.responseBuilder
//          .speak(`command ${command} activated   `)
            .addDirective(Util.buildStartEventHandler(token,60000, {}))
//          .reprompt("awaiting command")
            .addDirective(directive)
            .getResponse();
    }
};


// Construct and send a custom directive to the connected gadget with data from
// the DealCardsIntent request.
const DealCardsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DealCardsIntent';
    },
    handle: function (handlerInput) {

        let num = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Numbers');
        if (!num) {
            return handlerInput.responseBuilder
                .speak("Please tell number of cards?")
                .reprompt("How many do you want?").getResponse();
        }

        let player = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Color');
        if (!player) {
            player = 'all'
        }
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let token = attributesManager.getSessionAttributes().token;


        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'dealcard',
                command: num,
                player: player
            });

        return handlerInput.responseBuilder
    //        .speak(`Give  ${num} cards to ${player} `)
            .addDirective(Util.buildStartEventHandler(token,60000, {}))
            .reprompt("Anyone want more")
            .addDirective(directive)
            .getResponse();
    }
};


const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {
        let { request } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];

        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {

        console.log("== Received Custom Event ==");
        let customEvent = handlerInput.requestEnvelope.request.events[0];
        let payload = customEvent.payload;
        let name = customEvent.header.name;

        let speechOutput;
        if (name === 'Player') {
            let player = payload.player;
            let speechOutput = "Add one user color is " +player;
            return handlerInput.responseBuilder
                .speak(speechOutput, "REPLACE_ALL")
                .withShouldEndSession(false)
                .getResponse();
        } else if (name === 'Color') {
            if ('green' in payload) {
                speechOutput = "Color green event";
            }

        } else if (name === 'Speech') {
            speechOutput = payload.speechOut;

        } else {
            speechOutput = "Event not recognized. Awaiting new command.";
        }
        return handlerInput.responseBuilder
            .speak(speechOutput, "REPLACE_ALL")
            .getResponse();
    }
};

/*
const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        const attributesManager = handlerInput.attributesManager;
        let duration = attributesManager.getSessionAttributes().duration || 0;
        if (duration > 0) {
            Util.putSessionAttribute(handlerInput, 'duration', --duration);

            // Extends skill session
            const speechOutput = `${duration} minutes remaining.`;
            return handlerInput.responseBuilder
                .addDirective(Util.buildStartEventHandler(token, 60000, {}))
                .speak(speechOutput)
                .getResponse();
        }
        else {
            // End skill session
            return handlerInput.responseBuilder
                .speak("Skill duration expired. Goodbye.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};
*/

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SetSpeedIntentHandler,
        SetCommandIntentHandler,
        MoveIntentHandler,
        DealCardsIntentHandler,
        EventsReceivedRequestHandler,
  //      ExpiredRequestHandler,
        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();
    