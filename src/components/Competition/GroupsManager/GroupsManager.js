import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import pink from '@material-ui/core/colors/pink';

import GroupsNavigation from './GroupsNavigation/GroupsNavigation';
import SaveWcifButton from '../../common/SaveWcifButton/SaveWcifButton';

import { createGroupActivities, updateScrambleSetCount, assignTasks } from '../../../logic/groups';
import { allGroupsCreated, roundsMissingAssignments, anyResults } from '../../../logic/activities';
import { updateIn, mapIn, setIn } from '../../../logic/utils';

export default class GroupsManager extends Component {
  constructor(props) {
    super(props);
    this.state = {
      localWcif: props.wcif
    };
  }

  createGroupActivities = () => {
    const { localWcif } = this.state;
    this.setState({
      localWcif: updateScrambleSetCount(createGroupActivities(localWcif))
    });
  };

  assignTasks = () => {
    const { localWcif } = this.state;
    this.setState({ localWcif: assignTasks(localWcif) });
  };

  clearGroups = () => {
    const { localWcif } = this.state;
    const persons = localWcif.persons.map(person =>
      updateIn(person, ['assignments'], assignments =>
        assignments.filter(({ assignmentCode }) =>
          !assignmentCode.startsWith('staff-') && assignmentCode !== 'competitor'
        )
      )
    );
    const schedule = mapIn(localWcif.schedule, ['venues'], venue =>
      mapIn(venue, ['rooms'], room =>
        mapIn(room, ['activities'], activity => setIn(activity, ['childActivities'], []))
      )
    );
    this.setState({ localWcif: { ...localWcif, persons, schedule } });
  };

  render() {
    const { localWcif } = this.state;
    const { wcif, onWcifUpdate, history } = this.props;

    const groupsCreated = allGroupsCreated(localWcif);

    return (
      <Grid container spacing={8} justify="flex-end">
        <Grid item xs={12}>
          {!groupsCreated && (
            <SnackbarContent
              style={{ maxWidth: 'none' }}
              message="To assign tasks you need to create groups first. This will also determine scramble set count for each round."
              action={
                <Button onClick={this.createGroupActivities} style={{ color: pink[500] }} size="small">
                  Create groups
                </Button>
              }
            />
          )}
          {(groupsCreated && roundsMissingAssignments(localWcif).length > 0) && (
            <SnackbarContent
              style={{ maxWidth: 'none' }}
              message="There are rounds with no tasks assigned."
              action={
                <Button onClick={this.assignTasks} style={{ color: pink[500] }} size="small">
                  Assign tasks
                </Button>
              }
            />
          )}
        </Grid>
        <Grid item xs={12}>
          <GroupsNavigation wcif={localWcif} />
        </Grid>
        <Grid item>
          <Button variant="contained" component={Link} to={`/competitions/${localWcif.id}`}>
            Cancel
          </Button>
        </Grid>
        <Grid item>
          <Button variant="contained" onClick={this.clearGroups} disabled={anyResults(localWcif)}>
            Clear
          </Button>
        </Grid>
        <Grid item>
          <SaveWcifButton wcif={wcif} updatedWcif={localWcif} onWcifUpdate={onWcifUpdate} history={history} />
        </Grid>
      </Grid>
    );
  }
}
