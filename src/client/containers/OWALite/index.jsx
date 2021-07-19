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
import { connect } from 'react-redux'

import { fetchMails, unloadMails, deleteMail } from 'actions/mails'
import { showModal } from 'actions/common'

import PageTitle from 'components/PageTitle'
import PageContent from 'components/PageContent'

import helpers from 'lib/helpers'
import Button from 'components/Button'
import UIKit from 'uikit'
import Table from 'components/Table'
import TableRow from 'components/Table/TableRow'
import TableCell from 'components/Table/TableCell'
import TableHeader from 'components/Table/TableHeader'
import ButtonGroup from 'components/ButtonGroup'
import PageTitleButton from 'components/PageTitleButton'
import DropdownTrigger from 'components/Dropdown/DropdownTrigger'
import Dropdown from 'components/Dropdown'
import DropdownItem from 'components/Dropdown/DropdownItem'
import DropdownSeparator from 'components/Dropdown/DropdownSeperator'

class OWALiteContainer extends React.Component {
  constructor (props) {
    super(props)
  }

  componentDidMount () {
    this.props.fetchMails({ page: 0, limit: 1000 })
  }

  componentDidUpdate () {
    helpers.resizeFullHeight()
  }

  componentWillUnmount () {
    this.props.unloadMails()
  }

  onCreateTeamClick (e) {
    e.preventDefault()
    this.props.showModal('CREATE_TEAM')
  }

  onDeleteMailClick (_id) { //InternetMessageId
    UIKit.modal.confirm(
      `<h2>Are you sure?</h2>
        <p style="font-size: 15px;">
            <span class="uk-text-danger" style="font-size: 15px;">This is a permanent action.</span> 
        </p>
        <p style="font-size: 12px;">
            Agents may lose access to resources once this mail is deleted.
        </p>
        `,
      () => {
        this.props.deleteMail({ _id })
      },
      {
        labels: { Ok: 'Yes', Cancel: 'No' },
        confirmButtonClass: 'md-btn-danger'
      }
    )
  }

  onConvertConversationClick (_id) { //InternetMessageId
    UIKit.modal.confirm(
      `<h2>Are you sure?</h2>
        <p style="font-size: 15px;">
            <span class="uk-text-danger" style="font-size: 15px;">This will convert the whole email conversation into a ticket and commnets.</span> 
        </p>
        `,
      () => {
        this.props.deleteMail({ _id })
      },
      {
        labels: { Ok: 'Yes', Cancel: 'No' },
        confirmButtonClass: 'md-btn-danger'
      }
    )
  }

  onConvertEmailClick (_id) { //InternetMessageId
    UIKit.modal.confirm(
      `<h2>Are you sure?</h2>
        <p style="font-size: 15px;">
            <span class="uk-text-danger" style="font-size: 15px;">This will convert this email into a ticket.</span> 
        </p>
        `,
      () => {
        this.props.deleteMail({ _id })
      },
      {
        labels: { Ok: 'Yes', Cancel: 'No' },
        confirmButtonClass: 'md-btn-danger'
      }
    )
  }
  

  render () {
    const tableItems = this.props.mailsState.mails.map(mail => {
      return (
        <TableRow key={mail.get('_id')} className={'vam nbb'}>
          <TableCell style={{ fontWeight: 500, padding: '18px 15px' }}>{mail.get('from')}</TableCell>
          <TableCell style={{ padding: '13px 8px 8px 8px' }}>{mail.get('subject')}</TableCell>
          <TableCell style={{ paddingRight: 5 }}>
            <DropdownTrigger pos={'bottom-right'} offset={5} extraClass={'uk-float-left'}>
              <PageTitleButton fontAwesomeIcon={'fa-tasks'} />
              <Dropdown small={true} width={120}>
                <DropdownItem text={'Convert'} onClick={() => this.onConvertEmailClick(mail.get('_id'))} />
                <DropdownItem text={'Conversation'} onClick={() => this.onConvertConversationClick(mail.get('_id'))} />
                <DropdownItem text={'Comment'} onClick={() => this.props.showModal('EMAIL_COMMENT',{itemId: mail.get('_id') })} />
                {helpers.canUser('tickets:delete', true) && <DropdownSeparator />}
                {helpers.canUser('tickets:delete', true) && (
                  <DropdownItem text={'Delete'} extraClass={'text-danger'} onClick={() => this.onDeleteMailClick(mail.get('_id'))} />
                )}
              </Dropdown>
            </DropdownTrigger>
          </TableCell>
        </TableRow>
      )
    })

    return (
      <div>
        <PageTitle
          title={'Emails'}
          shadow={true}
          rightComponent={
            <div className={'uk-grid uk-grid-collapse'}>
              <div className={'uk-width-1-1 mt-15 uk-text-right'}>
                <Button
                  text={'Create'}
                  flat={false}
                  small={true}
                  waves={false}
                  extraClass={'hover-accent'}
                  onClick={e => this.onCreateTeamClick(e)}
                />
              </div>
            </div>
          }
        />
        <PageContent id={'teams-page-content'} padding={0} paddingBottom={0}>
          <Table
            headers={[
              <TableHeader key={0} width={'25%'} height={40} text={'From'} padding={'8px 8px 8px 15px'} />,
              <TableHeader key={1} width={'50%'} text={'Subject'} />,
              <TableHeader key={2} width={130} text={'Mail Actions'} />
            ]}
          >
            {this.props.mailsState.mails.size < 1 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <h5 style={{ paddingLeft: 8 }}>No Mails</h5>
                </TableCell>
              </TableRow>
            )}
            {tableItems}
          </Table>
        </PageContent>
      </div>
    )
  }
}

OWALiteContainer.propTypes = {
  mailsState: PropTypes.object.isRequired,
  fetchMails: PropTypes.func.isRequired,
  unloadMails: PropTypes.func.isRequired,
  deleteMail: PropTypes.func.isRequired,
  showModal: PropTypes.func.isRequired
}

const mapStateToProps = state => ({
  mailsState: state.mailsState
})

export default connect(
  mapStateToProps,
  { fetchMails, unloadMails, deleteMail, showModal }
)(OWALiteContainer)
