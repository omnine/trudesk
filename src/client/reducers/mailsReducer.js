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

import { fromJS, List } from 'immutable'
import { handleActions } from 'redux-actions'
import { CREATE_MAIL, CONDUCT_MAIL, FETCH_MAILS, UNLOAD_MAILS } from 'actions/types'

const initialState = {
  mails: List([])
}

const reducer = handleActions(
  {
    [FETCH_MAILS.SUCCESS]: (state, action) => {
      return {
        ...state,
        mails: fromJS(action.payload.response.mails)
      }
    },

    [CREATE_MAIL.SUCCESS]: (state, action) => {
      const resTeam = action.response.team
      const withInsertedTeam = state.mails.push(fromJS(resTeam))
      return {
        ...state,
        mails: withInsertedTeam.sortBy(team => team.get('name'))
      }
    },

    [CONDUCT_MAIL.SUCCESS]: (state, action) => {
      switch (action.payload.action) {
        case 'read':
          return {
            ...state,
            mailbody: fromJS(action.response.body)
          }
          break
        case 'case':
          return {
            ...state,
            tid: fromJS(action.response.tid)
          }
          break
        default:
          return { ...state }
      }
    },

    [UNLOAD_MAILS.SUCCESS]: state => {
      return {
        ...state,
        mails: state.mails.clear()
      }
    }
  },
  initialState
)

export default reducer
