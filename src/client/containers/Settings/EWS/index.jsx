/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    4/14/19 2:25 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { observable } from 'mobx'
import { updateSetting, updateMultipleSettings } from 'actions/settings'

import Button from 'components/Button'
import SettingItem from 'components/Settings/SettingItem'
import EnableSwitch from 'components/Settings/EnableSwitch'

import helpers from 'lib/helpers'


@observer
class EWSSettingsContainer extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      url: '',
      username: '',
      password: '',
      authcert:''
    }

  }

  componentDidMount () {
    helpers.UI.inputs()
  }

  componentDidUpdate () {
    helpers.UI.reRenderInputs()


  }

  static getDerivedStateFromProps (nextProps, state) {
    if (nextProps.settings) {
      let stateObj = { ...state }
      if (!state.url)
        stateObj.url = nextProps.settings.getIn(['settings', 'ewsUrl', 'value']) || ''
      if (!state.username)
        stateObj.username = nextProps.settings.getIn(['settings', 'ewsUsername', 'value']) || ''
      
      if (!state.password)
      stateObj.password = nextProps.settings.getIn(['settings', 'ewsPassword', 'value']) || ''

      if (!state.authcert)
      stateObj.authcert = nextProps.settings.getIn(['settings', 'msexAuthCert', 'value']) || ''      

      return stateObj
    }

    return null
  }

  onInputChanged (e, settingName) {
    this.setState({
      [settingName]: e.target.value
    })
  }

  onFormSubmit (e) {
    e.preventDefault()

    const payload = [{ name: 'ews:url', value: this.state.url }, 
      { name: 'ews:username', value: this.state.username }, 
      { name: 'ews:password', value: this.state.password },
      { name: 'gen:msex:authcert', value: this.state.authcert } //should we change the key?
    ]
    
    this.props.updateMultipleSettings(payload)
  }

  getSetting (name) {
    return this.props.settings.getIn(['settings', name, 'value'])
      ? this.props.settings.getIn(['settings', name, 'value'])
      : ''
  }

  onUseEWSAsMailer (e) {
    this.props.updateSetting({
      name: 'useEWSAsMailer:enable',
      value: e.target.checked,
      stateName: 'useEWSAsMailer',
      noSnackbar: true
    })
  }

  render () {
    return (
      <div className={this.props.active ? '' : 'hide'}>
        <SettingItem
          title={'Use it as the mailer'}
          subtitle={<div>Once enabled, it is not necessary to configure SMTP and IMAP.</div>}
          tooltip={'It only works with MS Exchange server or Office 365.'}
          component={
            <EnableSwitch
              stateName={'useEWSAsMailer'}
              label={'Enable'}
              checked={this.getSetting('useEWSAsMailer')}
              onChange={e => {
                this.onUseEWSAsMailer(e)
              }}
            />
          }
        />

        <SettingItem
          title={'EWS Server Configuration'}
          tooltip={'This is only used for Outlook Addin.'}
          subtitle={'The ews settings to the Exchange server.'}
        >
          <form onSubmit={e => this.onFormSubmit(e)}>
            <div className='uk-margin-medium-bottom'>
              <label>EWS Url</label>
              <input
                type='text'
                className={'md-input md-input-width-medium'}
                value={this.state.url}
                onChange={e => this.onInputChanged(e, 'url')}
              />
            </div>
            <div className='uk-margin-medium-bottom'>
              <label>Username</label>
              <input
                type='text'
                className={'md-input md-input-width-medium'}
                value={this.state.username}
                onChange={e => this.onInputChanged(e, 'username')}
              />
            </div>
            <div className='uk-margin-medium-bottom'>
              <label>Password</label>
              <input
                type='password'
                className={'md-input md-input-width-medium'}
                value={this.state.password}
                onChange={e => this.onInputChanged(e, 'password')}
              />
            </div>

            <div className='uk-margin-medium-bottom'>
              <label>Exchange Auth Certificate</label>
              <textarea
                className='md-input md-input-width-medium'
                rows="10" cols="50"
                value={this.state.authcert}
                onChange={e => this.onInputChanged(e, 'authcert')}
              />
            </div>

            <div className='uk-clearfix'>
              <Button
                text={'Apply'}
                type={'submit'}
                flat={true}
                waves={true}
                style={'success'}
                extraClass={'uk-float-right'}
              />
            </div>
          </form>
        </SettingItem>
      </div>
    )
  }
}

EWSSettingsContainer.propTypes = {
  active: PropTypes.bool.isRequired,
  settings: PropTypes.object.isRequired,
  updateSetting: PropTypes.func.isRequired,
  updateMultipleSettings: PropTypes.func.isRequired
}

const mapStateToProps = state => ({
  settings: state.settings.settings
})

export default connect(
  mapStateToProps,
  { updateSetting, updateMultipleSettings }
)(EWSSettingsContainer)
