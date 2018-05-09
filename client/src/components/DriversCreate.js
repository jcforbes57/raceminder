//import _ from 'lodash';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link, withRouter } from 'react-router-dom';

import { Field, reduxForm } from 'redux-form';
import { Form, FormGroup, Label, Input, FormFeedback, Button } from 'reactstrap';
//import { Multiselect } from 'react-widgets';

import moment from 'moment';
import momentLocalizer from 'react-widgets-moment';

import { createDriver } from '../actions';

import 'react-widgets/dist/css/react-widgets.css';

class DriversCreate extends Component {
  constructor(props) {
    super(props);

    this.state = {
      redirect: false,
      edit: false
    };

    moment.locale('en');
    momentLocalizer();
  }

  componentWillMount() {
    let id = null;
    if (this.props.match && this.props.match.params.id) {
      id = this.props.match.params.id;
    }
    const { drivers } = this.props;
    const driver = drivers && id ? drivers[id] : null;

    if (driver) {
      console.log('edit driver initial values: ', driver);
      this.setState({ edit: true });
      this.setState({ id: id });
      this.props.initialize(driver);
    }
  }

  componentDidMount() {
    console.log(this.refs);
  }

  onSubmit(values) {
    // this === our component
    this.props.createDriver(values);
    this.setState({ redirect: true });
  }

  renderField(field) {
    const {meta: {touched, error}, autoFocus } = field;
    return (
      <FormGroup>
        <Label>{field.label}</Label>
        <Input 
          valid={touched && error ? false : (touched ? true : null) } 
          invalid={touched && error ? true : false } 
          {...field.input} 
          type={field.type}
          autoFocus={autoFocus ? true : null}
          />
        <FormFeedback>{error}</FormFeedback>
      </FormGroup>
      );    
  }

  renderCancelButton() {
    if (this.props.history) {
      return (
          <Button onClick={this.props.history.goBack} color="secondary">Cancel</Button>
        )
    } else {
      return (
        <Button color="secondary" tag={Link} to="/">Cancel</Button>
      );
    }
  }

  render() {
    const { handleSubmit, pristine, submitting } = this.props;

    // if the form has been submitted, redirect
    // will be set.
    if (this.state.redirect) {
      this.props.history.goBack();
      return null;
    }

    return (
      <div>
        <h3>{this.state.edit ? 'Edit Driver' : 'Create New Driver'}</h3>
        <Form onSubmit={handleSubmit(this.onSubmit.bind(this))}>
          <Field label="First Name" name="firstname" type="text" autoFocus component={this.renderField} />
          <Field label="Last Name" name="lastname" type="text" component={this.renderField} />

          <div className="btn-toolbar">
            <Button type="submit" color="primary" disabled={pristine || submitting}>Save</Button>
            {this.renderCancelButton()}
          </div>
        </Form>
      </div>
      );
  }
}

function validate(values) {
  const errors = {};

  if (!values.firstname) {
    errors.firstname = 'You must enter a first name.';
  }

  if (!values.lastname) {
    errors.lastname = 'You must enter a last name.';
  }

  return errors;
}

const mapStateToProps = (state) => ({ drivers: state.drivers });

DriversCreate = connect(mapStateToProps, { createDriver })(DriversCreate);

export default reduxForm({
  form: 'DriversCreateForm',
  // optional: fields argument with names of Fields
  //fields: _.keys(FIELDS),
  validate
})(withRouter(DriversCreate));
