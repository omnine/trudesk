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
import { CREATE_MAIL, DELETE_MAIL, FETCH_MAILS, UNLOAD_MAILS, EMAIL_COMMENT } from 'actions/types'

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

    [EMAIL_COMMENT.SUCCESS]: (state, action) => {
      return { ...state }
    },

    [DELETE_MAIL.SUCCESS]: (state, action) => {
      const idx = state.mails.findIndex(t => {
        return t.get('_id') === action.payload._id
      })
      return {
        ...state,
        mails: state.mails.delete(idx)
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
