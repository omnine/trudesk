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

import React from 'react'
import PropTypes from 'prop-types'
import { observer } from 'mobx-react'
import { observable } from 'mobx'
import { connect } from 'react-redux'

import { email2Comment } from 'actions/mails'

import Button from 'components/Button'
import BaseModal from './BaseModal'

@observer
class Email2CommentModal extends React.Component {
  @observable name = ''

  onNameChange (e) {
    this.name = e.target.value
  }

  onEmail2CommentClicked (e) {
    e.preventDefault()

    this.props.email2Comment({ tid: this.name, itemId: this.props.itemId})
  }

  render () {
    return (
      <BaseModal>
        <div className={'uk-form-stacked'}>
          <div>
            <h2 className={'nomargin mb-5'}>Email to Comment</h2>
            <p className='uk-text-muted'>Add this email as a comment to an existing ticket</p>

            <label>Ticket Number</label>
            <input
              type='text'
              className={'md-input'}
              name={'name'}
              data-validation='length'
              data-validation-length='min3'
              data-validation-error-msg='Please enter the existing ticket id.'
              value={this.name}
              onChange={e => this.onNameChange(e)}
            />
          </div>
          <div className='uk-modal-footer uk-text-right'>
            <Button text={'Close'} extraClass={'uk-modal-close'} flat={true} waves={true} />
            <Button
              text={'Create'}
              type={'button'}
              flat={true}
              waves={true}
              style={'success'}
              onClick={e => this.onEmail2CommentClicked(e)}
            />
          </div>
        </div>
      </BaseModal>
    )
  }
}

Email2CommentModal.propTypes = {
  itemId: PropTypes.object,
  email2Comment: PropTypes.func.isRequired
}

export default connect(
  null,
  { email2Comment }
)(Email2CommentModal)
