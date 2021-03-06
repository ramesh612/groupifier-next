import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import AppBar from '@material-ui/core/AppBar';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';

import Scorecards from './Scorecards/Scorecards';
import CompetitorCards from './CompetitorCards/CompetitorCards';

export default class PrintingManager extends Component {
  state = {
    tabValue: 0
  };

  handleTabChange = (event, value) => {
    this.setState({ tabValue: value });
  };

  render() {
    const { tabValue } = this.state;
    const { wcif } = this.props;

    return (
      <Grid container spacing={8} justify="flex-end">
        <Grid item xs={12}>
          <AppBar position="static" color="default">
            <Tabs value={tabValue} onChange={this.handleTabChange} centered>
              <Tab label="Scorecards" />
              <Tab label="Competitor cards" />
            </Tabs>
          </AppBar>
        </Grid>
        <Grid item xs={12}>
          {tabValue === 0 && <Scorecards wcif={wcif} />}
          {tabValue === 1 && <CompetitorCards wcif={wcif} />}
        </Grid>
        <Grid item>
          <Button variant="contained" color="primary" component={Link} to={`/competitions/${wcif.id}`}>
            Done
          </Button>
        </Grid>
      </Grid>
    );
  }
}
