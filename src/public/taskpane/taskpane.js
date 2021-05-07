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
    document.getElementById('exchid').onclick = getExchID
    document.getElementById('keysave').onclick = keySave

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
  let si = item.subject.indexOf('[Ticket#62')

  if (si > 0) {
    let ei = item.subject.indexOf(']')
    let ticket = item.subject.substring(si + 10, ei)
    while (ticket[0] == '0') {
      ticket = ticket.substring(1)
    }
    window.location.href = 'https://helpdesk.deepnetsecurity.com/#ticket/zoom/' + ticket
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

/*
 * call zammad API to create a new ticket.
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

    var item = Office.context.mailbox.item
    let data = {
      title: item.subject,
      group: 'Support',
      customer: item.from.emailAddress,
      article: {
        subject: item.subject,
        body: bodyHtml,
        from: 'Support',
        to: item.from.emailAddress,
        content_type: 'text/html',
        type: 'email',
        internal: false
      }
    }

    $.ajax({
      url: 'https://helpdesk.deepnetsecurity.com/api/v1/tickets',
      method: 'POST',
      dataType: 'json',
      crossDomain: true,
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify(data),
      cache: false,
      beforeSend: function (xhr) {
        /* Authorization header */
        xhr.setRequestHeader('Authorization', 'Token token=' + userAPIToken)
      },
      success: function (result) {
        window.location.href = 'https://helpdesk.deepnetsecurity.com/#ticket/zoom/' + result.id

        // modify the subject by adding ticket number after the ticket is successfully created.
        // unfortunately, in read form, we can't do that. item.subject is a string, not object.

        let subject = item.subject
        if (result.id < 1000) {
          let tn = 62000 + result.id
          subject += ' [Ticket#' + tn + ']'
        } else {
          subject += ' [Ticket#62' + result.id + ']'
        }

        updateSubject(item.itemId, subject)
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
    let payload = parseJwt(data.value)
    let appctx = JSON.parse(payload.appctx)

    $('#msg_exchid').html(appctx.msexchuid)
    $('#msg_exchid').show()
  })
}

function getExchangeToken () {
  Office.context.mailbox.getUserIdentityTokenAsync(data => {
    //  confirmed we can get exchange token here.
    //      debugger;
    //  console.log(data.value);
    let exToken = data.value

    //use exchange token to get zammad API token
    $.post('https://helpdesk.deepnetsecurity.com/outlook/validate', {
      token: exToken
    })
      .done(function (result, status, xhr) {
        userAPIToken = result.token
        //enable the convert button, only when api token is available, which is necessary to make API call.
        document.getElementById('convert').disabled = false
      })
      .fail(function (xhr, status, error) {
        // then check local storage
        if (localStorage.getItem('apikey')) {
          userAPIToken = localStorage.getItem('apikey')
          document.getElementById('convert').disabled = false //also enable the button
        } else {
          $('#apikey').show()
        }
      })
  })
}

function keySave () {
  localStorage.setItem('apikey', $('#apikey').val())
  userAPIToken = $('#apikey').val()
  $('#group_apikey').hide()
  document.getElementById('convert').disabled = false
}

function updateSubject (itemId, subject) {
  let data = {
    itemId: itemId,
    subject: subject
  }

  $.ajax({
    url: 'https://helpdesk.deepnetsecurity.com/outlook/updatesubject',
    method: 'POST',
    dataType: 'json',
    crossDomain: true,
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify(data),
    cache: false,
    beforeSend: function (xhr) {
      /* Authorization header */
      xhr.setRequestHeader('Authorization', 'Token token=' + userAPIToken)
    },
    success: function (result) {},
    error: function (xhr, status, error) {
      //show this block to allow change API Token
      $('#group_apikey').show()
      $('#message').html('Result: Update subject ' + xhr.status + ' ' + xhr.statusText)
    }
  })
}
