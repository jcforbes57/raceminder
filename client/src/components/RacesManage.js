import _ from 'lodash';

import React, { Component } from 'react';
import { 
  Row, Col, FormGroup, 
  Button, ButtonGroup, Table, 
} from 'reactstrap';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import { BarLoader } from 'react-spinners';

import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faTrashAlt from '@fortawesome/fontawesome-free-regular/faTrashAlt';
import faPlusSquare from '@fortawesome/fontawesome-free-regular/faPlusSquare';
import faFlagCheckered from '@fortawesome/fontawesome-free-solid/faFlagCheckered';
import faFlag from '@fortawesome/fontawesome-free-solid/faFlag';

import moment from 'moment';
import momentLocalizer from 'react-widgets-moment';

import Clock from 'react-live-clock';

import StopModal from './StopModal';
import StintModal from './StintModal';

import { createRaceStop, deleteRaceStop, setSelectedStop,
  createRaceStint, deleteRaceStint, setSelectedStint,
  refreshRaceHero, connectRaceHeroSocket, disconnectRaceHeroSocket,
  connectRaceMonitorSocket, disconnectRaceMonitorSocket } from '../actions';

const STOPS = 'STOPS';
const STINTS = 'STINTS';

moment.locale('en');
momentLocalizer();

class RacesManage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      stopModalOpen: false,
      viewSelected: STINTS,
      stintModalOpen: false,
      flagColor: '#555',
      loading: true
    };

    console.log('RacesManage got race props: ', props.race);
  }

  componentDidMount() {
    if (this.props.race) {
      this.initialize(this.props);
    }
  }

  componentWillUnmount() {
    clearInterval(this.activeStintInterval);
    this.props.disconnectRaceHeroSocket(this.props.race);
    this.props.disconnectRaceMonitorSocket(this.props.race);
    //clearInterval(this.raceHeroInterval);
  }

  componentWillReceiveProps(newProps) {
    if (this.props.race !== newProps.race) {
      this.initialize(newProps);
    }

    if (this.props.race && this.props.race.stints !== newProps.race.stints) {
      this.updateActiveStint(newProps);
    }

    /*
    if (this.props.racehero && this.props.racehero.current_lap !== newProps.racehero.current_lap) {
      this.updateActiveStint(newProps);
    }
    */
   
    if (!newProps.racehero) {
      return;
    }

    if (newProps.racehero.latest_flag) {
      let flagColor = 'green';
      if (newProps.racehero.latest_flag.color === 'green') {
        flagColor = 'rgb(58,181,50)';
      } else {
        flagColor = newProps.racehero.latest_flag.color;
      }

      this.setState({ flagColor });
    }

    if (newProps.racehero.error) {
      //clearInterval(this.raceHeroInterval);
    }
  }

  initialize(props) {
    this.updateActiveStint(props);

    //this.props.refreshRaceHero(props.race);

    if (props.race.raceHeroName) {
      this.props.connectRaceHeroSocket(props.race);
    }

    if (props.race.raceMonitorId) {
      this.props.connectRaceMonitorSocket(props.race);
    }

    // refresh once a minute
    this.activeStintInterval = setInterval(() => { 
      // update active stint based on time
      this.updateActiveStint(props);

      // force re-render
      // this.setState(this.state);
      
    }, 10000);

    /*
    this.raceHeroInterval = setInterval(() => {
      props.refreshRaceHero(props.race);
    }, 30000);
    */
    this.setState({ loading: false });
  }

  updateActiveStint = props => {
    const now = moment();
    _.forEach(props.race.stints, stint => {
        const end = moment(stint.end);
        const start = moment(stint.start);
        if (start < now && end > now) {
          this.setState({ activeStintId: stint.id });
          return false;
        }
      });
  }

  onViewSelected = viewSelected => {
    this.setState({ viewSelected })
  }

  handleAddStint() {
    // get stop time of last stint
    const { race } = this.props;
    //const newStintId = createStintId(race);

    // sort stints by time to figure out initial time guess
    const stints = _.toArray(race.stints)
      .sort((a, b) => moment(a.start).format('X') - moment(b.start).format('X'));
    let start = null;
    let end = null;

    if (!_.isEmpty(stints)) {
      const lastStint = stints.slice(-1)[0];
      start = lastStint.end;
    } else {
      start = this.props.race.start;
    }

    end = moment(start);
    end = end.add(race.stintLength ? race.stintLength : 2, 'hours').format('Y-MM-DDTHH:mm:ss');

    const data = {
      start,
      end,
      driver: null,
      notes: ''
    };

    this.props.createRaceStint(this.props.race.id, data);

    // open stint dialog to edit it
    this.setState({ stintModalOpen: true });
  }

  handleDeleteStint(id) {
    this.props.deleteRaceStint(this.props.race.id, id);
    //console.log('stint ' + id + ' deleted');
  }

  handleStintModalClose = () => {
    //console.log('closing stint modal via state');
    this.setState({ stintModalOpen: false});
  }

  handleAddStop() {
    //const { race } = this.props;
    //const newStopId = createStopId(race);

    const data = {
      start: null,
      end: null,
      lap: null,
      length: null,
      fuel: null,
      driver: null,
      notes: ''
    };

    this.props.createRaceStop(this.props.race.id, data);

    // open stop dialog to edit it
    this.setState({ stopModalOpen: true });
  }

  handleDeleteStop(id) {
    this.props.deleteRaceStop(this.props.race.id, id);
  }

  handleStopModalClose = () => {
    //console.log('closing stint modal via state');
    this.setState({ stopModalOpen: false});
  }

  estimatedStopLapByFuel(stint) {
    const { track, car, race } = this.props;
    let lpg = null;
    if (car.mpg) {
      lpg = car.mpg / track.length;
    }

    if (!lpg || !stint.startingLap || !stint.startingFuel) {
      return null;
    }

    const fuelAvail = stint.startingFuel - car.desiredFuelReserve;
    const maxDistance = fuelAvail * car.mpg;
    const totalLaps = Math.floor(maxDistance / track.length);
    return totalLaps + stint.startingLap;
  }

  estimatedStopLapByTime(stint) {
    const { race } = this.props;
    if (!stint.start || !stint.end || !stint.startingLap || !race.avgLapTime) {
      return null;
    }

    // in seconds, converted from milliseconds
    const stintLength = parseInt(moment(stint.end) - moment(stint.start), 10) / 1000;
    const totalLaps = Math.floor(stintLength / race.avgLapTime);
    console.log('stintLength:',stintLength,'totalLaps',totalLaps);
    return totalLaps + stint.startingLap;
  }


  renderStopRow(stop) {
    const { race } = this.props;
    const duration = stop.start && stop.end ? 
      moment(moment(stop.end).diff(moment(stop.start))).format('mm:ss') : 
      '(unset)';

    return (
      <tr 
        key={stop.id} 
        onClick={() => { this.props.setSelectedStop(race.id, stop.id); this.setState({ stopModalOpen: true }); }} 
        style={{cursor: 'pointer'}}
      >
        <td>{(stop.start && moment(stop.start).format('LTS')) || '(unset)'}</td>
        <td>{stop.lap || '(unset)'}</td>
        <td>{duration}</td>
        <td>{(stop.driver && (this.props.drivers[stop.driver].firstname + ' ' + this.props.drivers[stop.driver].lastname)) || '(unset)'}</td>
        <td>FUEL REMAINING</td>
        <td>{stop.fuel || '(unset)'}</td>
        <td>EST NEXT STOP LAP</td>
        <td>{stop.notes || ''}</td>
        <td className="text-right">
          <Button color="link" onClick={e => { this.handleDeleteStop(stop.id); e.stopPropagation(); }}>
            <FontAwesomeIcon 
              icon={faTrashAlt} 
            />
          </Button>
        </td>
      </tr>
    );
  }

  renderStopTable() {
    const { race } = this.props;
    return (
      <Table className="race-data-table" hover responsive dark>
        <thead className="table-sm">
          <tr>
            <th scope="col">Start Time</th>
            <th scope="col">Lap #</th>
            <th scope="col">Stop Length</th>
            <th scope="col">New Driver</th>
            <th scope="col">Est. Fuel Remaining</th>
            <th scope="col">Fuel Added</th>
            <th scope="col">Est. Next Stop (Lap)</th>
            <th scope="col">Notes</th>
            <th scope="col" className="text-right"></th>
          </tr>
        </thead>
        <tbody>
          {_.map(race.stops, stop => this.renderStopRow(stop))}
        </tbody>
      </Table>
      );
  }

  renderStintRow(stint, index) {
    const { race, car, track } = this.props;

    let after = '';
    let end = moment(stint.end);
    let start = moment(stint.start);
    let now = moment();
    if (start < now && end > now) {
      after = 'bg-primary';
    } else if (end < now) {
      after = 'bg-secondary';
    }
    
    const currentLap = this.currentLap();
    const lapsTurned = currentLap && stint.startingLap ? currentLap - stint.startingLap : '(unset)';
    let fuelUsed = '(unknown)';
    let fuelRemaining = '(unknown)';
    if (car.mpg && stint.startingFuel && lapsTurned) {
      let distance = lapsTurned * track.length;
      fuelUsed = distance / car.mpg;
      fuelRemaining = stint.startingFuel - fuelUsed;
      if (car.desiredFuelReserve) {
        fuelRemaining = fuelRemaining - car.desiredFuelReserve;
      }
      fuelRemaining = Math.round(fuelRemaining * 10) / 10;
      fuelUsed = Math.round(fuelUsed * 10) / 10;
    }

    let stopLapByFuel = this.estimatedStopLapByFuel(stint);
    let stopLapByTime = this.estimatedStopLapByTime(stint);
    let stopLap = null;
    if (end < now) {
      stopLap = stint.endingLap ? stint.endingLap : 'unknown';
    } else {
      if (stopLapByFuel > stopLapByTime) {
        stopLap = stopLapByTime;
      } else {
        stopLap = stopLapByFuel;
      }
      if (!stopLap) stopLap = 'unknown';
    }

    return (
      <tr 
        key={stint.id} 
        className={after} 
        onClick={() => { this.props.setSelectedStint(race.id, stint.id); this.setState({ stintModalOpen: true }); }} 
        style={{cursor: 'pointer'}}
      >
        <th className="d-none d-sm-table-cell" scope="row">{index+1}</th>
        <td>{(stint.start && moment(stint.start).format('LTS')) || '(unset)'}</td>
        <td>{stint.startingLap || '(unset)'}</td>
        <td>{lapsTurned}</td>
        <td>{fuelUsed}</td>
        <td>{fuelRemaining}</td>
        <td className="d-none d-sm-table-cell">{(stint.end && moment(stint.end).format('LTS')) || '(unset)'}</td>
        <td>{stopLap}</td>        
        <td>{(stint.driver && (this.props.drivers[stint.driver].firstname + ' ' + this.props.drivers[stint.driver].lastname)) || '(unset)'}</td>
        {/*<td className="d-none d-md-table-cell" style={{ maxWidth: '500px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stint.notes || ''}</td>*/}
        <td className="text-right">
          <Button color="link">
            <FontAwesomeIcon 
              icon={faTrashAlt} 
              onClick={e => { this.handleDeleteStint(stint.id); e.stopPropagation(); }} 
            />
          </Button>
        </td>
      </tr>
    );
  }

  renderStintTable() {
    const { race } = this.props;

    // sorted stints for display
    let stints = _.toArray(race.stints)
      .sort((a, b) => moment(a.start).format('X') - moment(b.start).format('X'));
    return (
          <Table className="race-data-table" hover responsive dark>
            <thead className="table-sm" style={{ background: this.state.flagColor }}>
              <tr>
                <th className="d-none d-sm-table-cell" scope="col">Stint #</th>
                <th scope="col">Start Time</th>
                <th scope="col">Starting Lap</th>
                <th scope="col">Laps Turned</th>
                <th scope="col">Est. Fuel Used</th>
                <th scope="col">Est. Fuel Remaining</th>
                <th className="d-none d-sm-table-cell" scope="col">Stop Time</th>
                <th scope="col">Ending Lap <br/>(or Best Est.)</th>
                <th scope="col">Driver</th>
                {/*<th className="d-none d-md-table-cell" scope="col">Notes</th>*/}
                <th scope="col" className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {_.map(stints, (stint, index) => this.renderStintRow(stint, index))}
            </tbody>
          </Table>
      );
  }

  currentLap() {
    const { racehero, racemonitor, car } = this.props;

    if ((!racehero || !racehero.racer_sessions) && (!racemonitor || !racemonitor.laps)) {
      return null;
    }    

    if (racehero) {
      const data = _.find(racehero.racer_sessions, s => s.racer_number === car.number);
      //console.log('got racehero data for car ',carNumber,':',data);

      if (data && racehero.passings && data.racer_session_id) {
        const passings = _.find(racehero.passings, p => p.racer_session_id === data.racer_session_id);
        return passings.current_lap;
      }
    } else if (racemonitor) {
      const data = racemonitor.laps[car.number];
      if (data) {
        return data.lap;
      }
    }

    return null;
  }

  currentPosition() {
    const { racehero, racemonitor, car } = this.props;

    if ((!racehero || !racehero.racer_sessions) && (!racemonitor || !racemonitor.laps)) {
      return null;
    }  

    if (racehero) {
      const data = _.find(racehero.racer_sessions, s => s.racer_number === car.number);
      //console.log('got racehero data for car ',car.number,':',data);

      if (data && racehero.passings && data.racer_session_id) {
        const passings = _.find(racehero.passings, p => p.racer_session_id === data.racer_session_id);
        return passings.position_in_class;
      }
    } else if (racemonitor) {
      const data = racemonitor.laps[car.number];
      if (data ) {
        return data.position;
      }
    }

    return null;
  }    
  
  lastLapTime() {
    const { racehero, racemonitor, car } = this.props;

    if ((!racehero || !racehero.racer_sessions) && (!racemonitor || !racemonitor.laps)) {
      return null;
    }  

    if (racehero) {
      const data = _.find(racehero.racer_sessions, s => s.racer_number === car.number);
      //console.log('got racehero data for car ',carNumber,':',data);

      if (data && racehero.passings && data.racer_session_id) {
        const passings = _.find(racehero.passings, p => p.racer_session_id === data.racer_session_id);

        const lapTime = moment(passings.last_lap_time_seconds * 1000).format('mm:ss.SS');
        return lapTime;
        //return passings.last_lap_time;
      }
    } else if (racemonitor) {
      const data = racemonitor.laps[car.number];
      if (data) {
        return data.lapTime;
      }
    }
    return null;
  }

  remainingLapsByFuel() {
  }

  remainingLapsByTime() {
    const { race } = this.props;

    if (!this.state.activeStintId) {
      return 0;
    }
    const activeStint = race.stints[this.state.activeStintId];
  }

  render() {
    const { race, car, track, racehero } = this.props;
   
    if (this.state.loading) {
      return(
        <div style={{position: 'fixed', top: '50%', left: '50%', marginLeft: '-50px' }}>
          <BarLoader color={'#123abc'} loading={this.state.loading} />      
        </div>
        );
    }    

    const remLaps = this.remainingLapsByTime();
    console.log('remaining laps:', remLaps);
    let color = this.state.flagColor;
    if (moment().isAfter(race.end)) {
      color = 'gray';
    }

    return (
      <div>
        <Row className="mb-2 bg-dark text-light">
          <Col xs={4}>
            <h3>{race.name}</h3>
            <h5 className="d-none d-md-block">Track: {track.name}</h5>
            {racehero &&
              <h5 className="d-none d-md-block">Lead Lap: {racehero.current_lap}</h5>
            }
          </Col>

          <Col className="d-none d-sm-inline-block text-center">
            <img 
              src={car.picture} 
              alt="Car" 
              className="rounded mb-1"
              style={{maxWidth: '100px', maxHeight: '100px' }}
            />
            <FontAwesomeIcon icon={faFlag} style={{ fontSize: '50px', color, filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' }} />
          </Col>

          <Col xs={6} className="text-right">
            <h4 className="time-of-day">
              <div className="digital-clock-container">
                <div className="digital-clock-ghosts">88:88:88 88</div>
                <Clock format={'h:mm:ss A'} ticking={true} className={`text-${color} digital-clock`} />
              </div>
            </h4>

            <FormGroup className="row">
              <Col>
                <Button tag={Link} to={`/races/${race.id}`} color="primary">Edit Race</Button>
              </Col>
            </FormGroup>

            { race &&
            <div>
              <strong className="mr-1">Our Car Current Lap:</strong>
              {this.currentLap()}
            </div>
            }

            { race &&
            <div>
              <strong className="mr-1">Last Lap Time:</strong>
              {this.lastLapTime()}
            </div>
            }

            { race &&
            <div>
              <strong className="mr-1">Position In Class:</strong>
              {this.currentPosition()}
            </div>
            }
          </Col>

        </Row>


        <Row>
          <Col xs={6}>
            <strong className="mr-1">Start Time:</strong>
            {moment(race.start).format('llll')}
          </Col>
          <Col xs={6} className="text-right">
            <strong className="mr-1">End Time:</strong>
            {moment(race.end).format('llll')}
          </Col>
        </Row>

        <FormGroup>
          <Button 
            className="btn-block" 
            color="danger" 
            onClick={() => { this.props.setSelectedStop(race.id, null); this.setState({ stopModalOpen: true }); }}>
              <FontAwesomeIcon icon={faFlagCheckered} className="mr-2" />
              Start Pit Stop
          </Button>
        </FormGroup>

        <StopModal 
          race={race}
          lap={this.currentLap()}
          stopId={race.selectedStopId}
          activeStintId={this.state.activeStintId}
          isOpen={this.state.stopModalOpen} 
          onClose={this.handleStopModalClose} />
        
        <StintModal 
          race={race} 
          stintId={race.selectedStintId} 
          activeStintId={this.state.activeStintId}
          isOpen={this.state.stintModalOpen} 
          onClose={this.handleStintModalClose} />

        <FormGroup className="row">
          <Col>
            <ButtonGroup>
              <Button 
                color="primary" 
                onClick={() => this.onViewSelected(STINTS)} 
                active={this.state.viewSelected === STINTS}>
                Stints
              </Button>
              <Button 
                color="primary" 
                onClick={() => this.onViewSelected(STOPS)} 
                active={this.state.viewSelected === STOPS}>
                Stops
              </Button>
            </ButtonGroup>
          </Col>

          <Col className="ml-auto text-right">
            {this.state.viewSelected === STINTS &&
              <Button onClick={() => this.handleAddStint()}>
                <FontAwesomeIcon icon={faPlusSquare} className="mr-1" />
                Add
              </Button>
            }
          </Col>
        </FormGroup>

        <Row>
          <Col>
            {this.state.viewSelected === STOPS ? this.renderStopTable() : this.renderStintTable()}
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps({ races, cars, drivers, tracks, externalData }, ownProps) {
  const id = ownProps.match.params.id;
  return { 
    drivers, 
    race: races[id], 
    car: cars && races[id] ? cars[races[id].car] : null, 
    track: tracks && races[id] ? tracks[races[id].track] : null,
    racehero: externalData && externalData.racehero ? externalData.racehero[id] : null,
    racemonitor: externalData.racemonitor ? externalData.racemonitor[id] : null
  };
}

export default connect(mapStateToProps, { 
  createRaceStop, 
  deleteRaceStop, 
  setSelectedStop,
  createRaceStint, 
  deleteRaceStint,
  setSelectedStint,
  refreshRaceHero,
  connectRaceHeroSocket,
  disconnectRaceHeroSocket,
  connectRaceMonitorSocket,
  disconnectRaceMonitorSocket
})(RacesManage);
