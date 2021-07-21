/*
 *                                               $$\                     $$\
 *                                               $$ |                    $$ |
 * $$$$$$$\   $$$$$$\  $$$$$$$\   $$$$$$\   $$$$$$$ | $$$$$$\   $$$$$$$\ $$ |  $$\
 * $$  __$$\  \____$$\ $$  __$$\ $$  __$$\ $$  __$$ |$$  __$$\ $$  _____|$$ | $$  |
 * $$ |  $$ | $$$$$$$ |$$ |  $$ |$$ /  $$ |$$ /  $$ |$$$$$$$$ |\$$$$$$\  $$$$$$  /
 * $$ |  $$ |$$  __$$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |$$   ____| \____$$\ $$  _$$<
 * $$ |  $$ |\$$$$$$$ |$$ |  $$ |\$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$$$$$$  |$$ | \$$\
 * \__|  \__| \_______|\__|  \__| \______/  \_______| \_______|\_______/ \__|  \__|
 *  ========================================================================
 *  Author:     Omnine
 *  Updated:    6/14/21 2:32 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import { call, put, takeLatest } from 'redux-saga/effects'
import {
  CREATE_MAIL,
  CONDUCT_MAIL,
  READ_MAIL,
  FETCH_MAILS,
  HIDE_MODAL,
  UNLOAD_MAILS,
  EMAIL_COMMENT
} from 'actions/types'

import Log from '../../logger'
import api from '../../api'
import helpers from 'lib/helpers'

function * fetchMails ({ payload, meta }) {
  try {
    const response = yield call(api.mails.getWithPage, payload)
    yield put({ type: FETCH_MAILS.SUCCESS, payload: { response, payload }, meta })
  } catch (error) {
    const errorText = error.response ? error.response.data.error : error
    helpers.UI.showSnackbar(`Error: ${errorText}`, true)
    Log.error(errorText, error)
    yield put({ type: FETCH_MAILS.ERROR, error })
  }
}

function * createMail ({ payload }) {
  try {
    const response = yield call(api.mails.create, payload)
    yield put({ type: CREATE_MAIL.SUCCESS, response })
    yield put({ type: HIDE_MODAL.ACTION })
  } catch (error) {
    const errorText = error.response.data.error
    helpers.UI.showSnackbar(`Error: ${errorText}`, true)
    yield put({ type: CREATE_MAIL.ERROR, error })
  }
}

function * email2Comment ({ payload }) {
  try {
    const response = yield call(api.mails.email2Comment, payload)
    yield put({ type: EMAIL_COMMENT.SUCCESS, response })
    yield put({ type: HIDE_MODAL.ACTION })
  } catch (error) {
    const errorText = error.response.data.error
    helpers.UI.showSnackbar(`Error: ${errorText}`, true)
    yield put({ type: EMAIL_COMMENT.ERROR, error })
  }
}

function * readMail ({ payload }) {
  try {
    const response = yield call(api.mails.readMail, payload)
    yield put({ type: READ_MAIL.SUCCESS, payload, response })
  } catch (error) {
    const errorText = error.response ? error.response.data.error : error
    helpers.UI.showSnackbar(`Error: ${errorText}`, true)
    Log.error(errorText, error)
    yield put({ type: READ_MAIL.ERROR, error })
  }
}

function * conductMail ({ payload }) {
  try {
    const response = yield call(api.mails.conductMail, payload)
    yield put({ type: CONDUCT_MAIL.SUCCESS, payload, response })
  } catch (error) {
    const errorText = error.response ? error.response.data.error : error
    helpers.UI.showSnackbar(`Error: ${errorText}`, true)
    Log.error(errorText, error)
    yield put({ type: CONDUCT_MAIL.ERROR, error })
  }
}

function * unloadThunk ({ payload, meta }) {
  try {
    yield put({ type: UNLOAD_MAILS.SUCCESS, payload, meta })
  } catch (error) {
    Log.error(error)
  }
}

export default function * watcher () {
  yield takeLatest(FETCH_MAILS.ACTION, fetchMails)
  yield takeLatest(CREATE_MAIL.ACTION, createMail)
  yield takeLatest(EMAIL_COMMENT.ACTION, email2Comment)
  yield takeLatest(CONDUCT_MAIL.ACTION, conductMail)
  yield takeLatest(READ_MAIL.ACTION, readMail)
  yield takeLatest(UNLOAD_MAILS.ACTION, unloadThunk)
}
