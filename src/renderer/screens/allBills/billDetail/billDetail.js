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

import { ArrowExportLtr16Filled, Edit16Regular } from '@fluentui/react-icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import globalUtils from '../../../services/globalUtils';
import './style.css';
import constants from '../../../constants';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';

function openViewBundleWindow(bundleId) {
  window.electron.ipcRenderer.sendMessage('new-window', {
    type: constants.windowConstants.VIEW_BUNDLE,
    data: { bundleId },
  });
}

function BillDetailDialog({ order, party, withUser, mrUser, onEdit, onClose }) {
  const { allUsers } = useAuthUser();
  const navigate = useNavigate();

  const openFlowSource = (flowEntry) => {
    if (flowEntry.bundleId) {
      openViewBundleWindow(flowEntry.bundleId);
    } else if (flowEntry.supplyReportId) {
      navigate('/viewSupplyReport', {
        state: { supplyReportId: flowEntry.supplyReportId },
      });
    }
  };

  const getFlowLinkId = (flowEntry) =>
    flowEntry.bundleId || flowEntry.supplyReportId;

  console.log(order.id);
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
        <div className="bill-detail-content-container">
          <Text className="label">Goods: </Text>
          <Text className="value">
            Polybags: {globalUtils.getBagQuantity(order.bags, 'polybag')},{' '}
            Cases: {globalUtils.getBagQuantity(order.bags, 'case')}, Packets:{' '}
            {globalUtils.getBagQuantity(order.bags, 'packet')}
          </Text>
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
            {order.flow?.map((fl, index) => {
              const flowLinkId = getFlowLinkId(fl);
              const flowKey = `bill-flow-${fl.type}-${fl.timestamp}-${index}`;

              if (flowLinkId) {
                return (
                  <Button
                    key={flowKey}
                    appearance="subtle"
                    onClick={() => openFlowSource(fl)}
                  >
                    {fl.type}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <ArrowExportLtr16Filled />
                  </Button>
                );
              }

              return (
                <Popover key={flowKey}>
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
        {onClose ? (
          <Button appearance="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="secondary">Close</Button>
          </DialogTrigger>
        )}
        {onEdit && (
          <Button appearance="primary" icon={<Edit16Regular />} onClick={onEdit}>
            Edit
          </Button>
        )}
      </DialogActions>
    </DialogBody>
  );
}

export default BillDetailDialog;
