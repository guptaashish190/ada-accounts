import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
} from '@fluentui/react-components';

import { ArrowExportLtr16Filled } from '@fluentui/react-icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import globalUtils from '../../../services/globalUtils';
import './style.css';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';

function BillDetailDialog({ order, party, withUser, mrUser }) {
  const { allUsers } = useAuthUser();
  const navigate = useNavigate();
  return (
    <DialogBody>
      <DialogTitle>
        <center>{order.billNumber?.toUpperCase()}</center>
      </DialogTitle>
      <DialogContent className="bill-detail-container">
        <div className="bill-detail-content-container">
          <Text className="label">Party: </Text>
          <Text className="value">{party.name}</Text>
        </div>
        <div className="bill-detail-content-container">
          <Text className="label">Bill Amount: </Text>
          <Text className="value">
            {globalUtils.getCurrencyFormat(order.orderAmount)}
          </Text>
        </div>

        <div className="bill-detail-content-container">
          <Text className="label">Area: </Text>
          <Text className="value">{order.area?.toUpperCase()}</Text>
        </div>
        <div className="bill-detail-content-container">
          <Text className="label">Balance: </Text>
          <Text className="value">
            {globalUtils.getCurrencyFormat(order.balance)}
          </Text>
        </div>
        <div className="bill-detail-content-container">
          <Text className="label">MR: </Text>
          <Text className="value">{mrUser}</Text>
        </div>
        <div className="bill-detail-content-container">
          <Text className="label">With: </Text>
          <Text className="value">{withUser}</Text>
        </div>
        {order.supplyReportId ? (
          <Button
            onClick={() => {
              navigate('/viewSupplyReport', {
                state: { supplyReportId: order.supplyReportId },
              });
            }}
          >
            Supply Report
          </Button>
        ) : null}
        <div className="bill-detail-content-container bill-flow">
          <VerticalSpace1 />
          <Text className="label">Flow: </Text>
          <div className="flow-container">
            {order.flow.map((fl) => {
              return (
                <Popover>
                  <PopoverTrigger disableButtonEnhancement>
                    <Button appearance="subtle">
                      {fl.type}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      <ArrowExportLtr16Filled />
                    </Button>
                  </PopoverTrigger>

                  <PopoverSurface>
                    <div>
                      <h3>{fl.type}</h3>
                      <b>Time: {globalUtils.getTimeFormat(fl.timestamp)}</b>
                      <div>
                        Updated by:{' '}
                        {
                          allUsers.find((x) => x.uid === fl.employeeId)
                            ?.username
                        }
                      </div>
                      <div>Comment: {fl.comment}</div>
                    </div>
                  </PopoverSurface>
                </Popover>
              );
            })}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <DialogTrigger disableButtonEnhancement>
          <Button appearance="secondary">Close</Button>
        </DialogTrigger>
        <Button appearance="primary">Do Something</Button>
      </DialogActions>
    </DialogBody>
  );
}

export default BillDetailDialog;
