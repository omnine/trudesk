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

import { createAction } from 'redux-actions'
import { CREATE_MAIL, CONDUCT_MAIL, READ_MAIL, FETCH_MAILS, UNLOAD_MAILS, EMAIL_COMMENT } from 'actions/types'

export const fetchMails = createAction(FETCH_MAILS.ACTION, payload => payload, () => ({ thunk: true }))
export const createMail = createAction(CREATE_MAIL.ACTION)
export const conductMail = createAction(CONDUCT_MAIL.ACTION)
export const readMail = createAction(READ_MAIL.ACTION)
export const unloadMails = createAction(UNLOAD_MAILS.ACTION, payload => payload, () => ({ thunk: true }))

export const email2Comment = createAction(EMAIL_COMMENT.ACTION)
