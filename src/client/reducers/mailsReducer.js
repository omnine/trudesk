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
import { CREATE_MAIL, DELETE_MAIL, FETCH_MAILS, UNLOAD_MAILS } from 'actions/types'

const initialState = {
  teams: List([])
}

const reducer = handleActions(
  {
    [FETCH_MAILS.SUCCESS]: (state, action) => {
      return {
        ...state,
        teams: fromJS(action.payload.response.teams)
      }
    },

    [CREATE_MAIL.SUCCESS]: (state, action) => {
      const resTeam = action.response.team
      const withInsertedTeam = state.teams.push(fromJS(resTeam))
      return {
        ...state,
        teams: withInsertedTeam.sortBy(team => team.get('name'))
      }
    },

    [DELETE_MAIL.SUCCESS]: (state, action) => {
      const idx = state.teams.findIndex(t => {
        return t.get('_id') === action.payload._id
      })
      return {
        ...state,
        teams: state.teams.delete(idx)
      }
    },

    [UNLOAD_MAILS.SUCCESS]: state => {
      return {
        ...state,
        teams: state.teams.clear()
      }
    }
  },
  initialState
)

export default reducer
