import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CreateSupplyReportScreen from '../createSupplyReport/createSupplyReport';

export default function ViewSupplyReportScreen() {
  const location = useLocation();

  const locationState = location.state;
  const prefillSupplyReport = locationState?.prefillSupplyReport;

  return (
    <div>
      <CreateSupplyReportScreen prefillSupplyReport={prefillSupplyReport} />
    </div>
  );
}
