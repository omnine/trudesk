/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */
//var $ = require("jquery");

var userAPIToken = ''

Office.onReady(info => {
  if (info.host === Office.HostType.Outlook) {
    //    document.getElementById("sideload-msg").style.display = "none";
    //    document.getElementById("app-body").style.display = "flex";
    document.getElementById('run').onclick = run
    document.getElementById('convert').onclick = email2Case
    document.getElementById('convert-conversation').onclick = conversations2Case
    document.getElementById('exchid').onclick = getExchID

    $('#apikey').on('input', function () {
      if ($('#apikey').val()) {
        document.getElementById('keysave').disabled = false
      } else {
        document.getElementById('keysave').disabled = true
      }
    })
    // Set up ItemChanged event
    Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, selectedMailItemChanged)
    doSomething(Office.context.mailbox.item)

    getExchangeToken()
  }
})

function selectedMailItemChanged (eventArgs) {
  console.log('Another email message selected')

  if (Office.context.mailbox.item != null) {
    doSomething(Office.context.mailbox.item)
  } else {
    console.log('No email is selected.')
    Office.context.mailbox.removeHandlerAsync(
      Office.EventType.ItemChanged,
      { handler: selectedMailItemChanged },
      function (result) {
        console.log('Item Change event unregistered.')
        Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, selectedMailItemChanged)
        console.log('Item Change event re-registered.')
      }
    )
  }
}

/*
 *  do something on the new selected mail item
 */
function doSomething (item) {
  //if the subject contains Ticket,  go to the ticket.
  // navigate to the related case
  // todo better to use template defined in Settings
  var startIndex = item.subject.indexOf('[DISSUE#')
  if (startIndex >= 0) {
    console.log('doSomething' + startIndex)
    startIndex = startIndex + 8
    var endIndex = item.subject.indexOf(']', startIndex)
    if (endIndex > startIndex) {
      var tid = item.subject.substring(startIndex, endIndex)
      window.location.href = 'https://helpdesk.deepnetsecurity.com/tickets/' + tid
    }
  }
}

export async function run () {
  /**
   * Insert your Outlook code here
   */
}

function escapeHtml (str) {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
}

// todo
export async function email2Comment () {
  // get the ticket no from input
  var tid = document.getElementById('ticket').value
  var item = Office.context.mailbox.item
  let data = {
    itemId: item.itemId,
    tid: tid
  }
  $.ajax({
    url: 'https://helpdesk.deepnetsecurity.com/email2comment',
    method: 'POST',
    dataType: 'json',
    crossDomain: true,
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify(data),
    cache: false,
    success: function (result) {
      window.location.href = 'https://helpdesk.deepnetsecurity.com/tickets/' + tid
    },
    error: function (xhr, status, error) {
      //show this block to allow change API Token
      $('#group_apikey').show()
      $('#message').html('Result: ' + xhr.status + ' ' + xhr.statusText)
    }
  })
}

export async function conversations2Case () {
  // get MailItem.ConversationID as the paramter, https://docs.microsoft.com/en-us/javascript/api/outlook/office.messageread?view=outlook-js-1.5&preserve-view=true#conversationId
  var item = Office.context.mailbox.item
  let data = {
    conversationId: item.conversationId
  }

  $.ajax({
    url: 'https://helpdesk.deepnetsecurity.com/conversations2case',
    method: 'POST',
    dataType: 'json',
    crossDomain: true,
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify(data),
    cache: false,
    beforeSend: function (xhr) {
      /* Authorization header */
      xhr.setRequestHeader('accesstoken', userAPIToken)
    },
    success: function (result) {
      window.location.href = 'https://helpdesk.deepnetsecurity.com/tickets/' + result.uid
    },
    error: function (xhr, status, error) {
      //show this block to allow change API Token
      $('#group_apikey').show()
      $('#message').html('Result: ' + xhr.status + ' ' + xhr.statusText)

      //remove cookies as well to avoid wrong csrf check
    }
  })
}

/*
 * call the API to create a new ticket.
 */
export async function email2Case () {
  //disable the button just in case people click it twice
  document.getElementById('convert').disabled = true
  //debugger;

  //Use office.js to get mail body content
  Office.context.mailbox.item.body.getAsync(Office.CoercionType.Html, result => {
    if (result.status === Office.AsyncResultStatus.Failed) {
      // show some error message?
      return
    }

    let bodyHtml = result.value
    //ticket and comment may need to create seperately.
    var item = Office.context.mailbox.item
    let data = {
      itemId: item.itemId,
      from: item.from.emailAddress,
      subject: item.subject,
      body: bodyHtml
    }

    $.ajax({
      url: 'https://helpdesk.deepnetsecurity.com/email2case',
      method: 'POST',
      dataType: 'json',
      crossDomain: true,
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify(data),
      cache: false,
      beforeSend: function (xhr) {
        /* Authorization header */
        xhr.setRequestHeader('accesstoken', userAPIToken)
      },
      success: function (result) {
        window.location.href = 'https://helpdesk.deepnetsecurity.com/tickets/' + result.uid
      },
      error: function (xhr, status, error) {
        //show this block to allow change API Token
        $('#group_apikey').show()
        $('#message').html('Result: ' + xhr.status + ' ' + xhr.statusText)

        //remove cookies as well to avoid wrong csrf check
      }
    })
  })
}

function parseJwt (token) {
  var base64Url = token.split('.')[1]
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  // decodeURIComponent
  var jsonPayload = atob(base64)
  return JSON.parse(jsonPayload)
}

export async function getExchID () {
  /*
 let token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkNKbThxdFVzZ2psVUI3ajBJYXZYTzd2RWFVYyJ9.eyJpc3MiOiIwMDAwMDAwMi0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDBAZGVlcG5ldHNlY3VyaXR5LmNvbSIsImF1ZCI6Imh0dHBzOi8vaGVscGRlc2suZGVlcG5ldHNlY3VyaXR5LmNvbS9vdXRsb29rL3Rhc2twYW5lLmh0bWwiLCJuYmYiOjE1ODQwOTQzNzksImV4cCI6MTU4NDEyMzE3OSwiYXBwY3R4c2VuZGVyIjoiMDAwMDAwMDItMDAwMC0wZmYxLWNlMDAtMDAwMDAwMDAwMDAwQGRlZXBuZXRzZWN1cml0eS5jb20iLCJpc2Jyb3dzZXJob3N0ZWRhcHAiOiJUcnVlIiwiYXBwY3R4Ijoie1wibXNleGNodWlkXCI6XCI0MzBhMmM1Yy03MTA0LTRiODYtOTFkMi1lYWI0ZTNmNjgxMjBcIixcInZlcnNpb25cIjpcIkV4SWRUb2suVjFcIixcImFtdXJsXCI6XCJodHRwczovL21haWwuZGVlcG5ldHNlY3VyaXR5LmNvbTo0NDMvYXV0b2Rpc2NvdmVyL21ldGFkYXRhL2pzb24vMVwifSJ9.DzpF-ygsRX61OF6nbsPwPg-wukHJljsFUPxsah46VoRPkZlqQiPHU-Z-GG05qxfGPTWml306TRHy_S59f90lnAepJ7yMGjlos0OFJda5f9NH1BMYYqkrz4_89RR5zlf9pkXTYnGeYXTDrL58BSML8zcsuz8f4e9CUmXA4kAfAFVTJxCD49BZpwAILyt7ddiCbVbx9D7FnWE-Z43zjUEqPDW9OMWp7ANhRjJDQDsTevvDpDQE_Bj1Kwkowuu7H8UtRvuD-_sU5tAQmuWH5_RZNuY9QSKxsHzdzM2FALxfnBJbflH75lcPeguKqVOP-3l_y5dQVRGxD8tUg40VLPsGnQ";
 let decoded = parseJwt(token);
 console.log(decoded);
*/

  Office.context.mailbox.getUserIdentityTokenAsync(data => {
    if (data.status === 'failed') {
      alert(data.error.message)
      return
      //      alert(JSON.stringify(data));
    }

    let payload = parseJwt(data.value)
    let appctx = JSON.parse(payload.appctx)

    $('#msg_exchid').html(appctx.msexchuid)
    $('#msg_exchid').show()
  })
}

function getExchangeToken () {
  Office.context.mailbox.getUserIdentityTokenAsync(data => {
    if (data.status === 'failed') {
      alert(data.error.message)
      return
      /*
      see the solution at https://help.salesforce.com/articleView?id=000321295&type=1&mode=1
      also see the discusstion at https://trailblazers.salesforce.com/answers?id=9063A000000eOL0QAM
      http://byronwright.blogspot.com/2018/05/expired-microsoft-exchange-server-auth.html

      data.status = 'failed'
      data.diagnostics.ErrorText=	'The token for this extension could not be retrieved.'
      data.error.code = 9042
      data.error.message = 'The Exchange server returned an error. Please look at the diagnostics object for more information.'
      */
    }

    //  sent the original JWT token (based64) to the server
    let exToken = data.value

    //use exchange token to get trudesk API token
    $.ajax({
      method: 'POST',
      url: 'https://helpdesk.deepnetsecurity.com/msexchlogin',
      data: {
        source: 'nanoart',
        token: exToken
      },
      error: function (e) {
        // then check local storage
        if (localStorage.getItem('apikey')) {
          userAPIToken = localStorage.getItem('apikey')
          document.getElementById('convert').disabled = false //also enable the button
        } else {
          $('#apikey').show()
        }

        console.error(e)
      },
      success: function (result) {
        userAPIToken = result.token
        //enable the convert button, only when api token is available, which is necessary to make API call.
        document.getElementById('convert').disabled = false
        document.getElementById('convert-conversation').disabled = false
        $('#message').html('Logged in as: ' + result.email)
      }
    })
  })
}
