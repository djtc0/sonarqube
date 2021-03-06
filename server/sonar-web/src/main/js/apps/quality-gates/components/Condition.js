/*
 * SonarQube
 * Copyright (C) 2009-2016 SonarSource SA
 * mailto:contact AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import React, { Component } from 'react';
import Select from 'react-select';

import ThresholdInput from './ThresholdInput';
import DeleteConditionView from '../views/gate-conditions-delete-view';
import Checkbox from '../../../components/controls/Checkbox';
import { createCondition, updateCondition } from '../../../api/quality-gates';
import { translate, getLocalizedMetricName } from '../../../helpers/l10n';
import { formatMeasure } from '../../../helpers/measures';

export default class Condition extends Component {
  constructor (props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {
      changed: false,
      period: props.condition.period,
      op: props.condition.op,
      warning: props.condition.warning || '',
      error: props.condition.error || ''
    };
  }

  componentDidMount () {
    const { condition } = this.props;

    if (!condition.id) {
      this.refs.operator.focus();
    }
  }

  handleChange () {
    this.setState({ changed: true });
  }

  handleOperatorChange (option) {
    const { value } = option;
    this.setState({ changed: true, op: value });
  }

  handlePeriodChange (checked) {
    const period = checked ? '1' : undefined;
    this.setState({ changed: true, period });
  }

  handleWarningChange (value) {
    this.setState({ changed: true, warning: value });
  }

  handleErrorChange (value) {
    this.setState({ changed: true, error: value });
  }

  handleSaveClick (e) {
    const { qualityGate, condition, onSaveCondition, onError, onResetError } = this.props;
    const period = this.state.period;
    const data = {
      metric: condition.metric,
      op: this.state.op,
      warning: this.state.warning,
      error: this.state.error
    };

    if (period) {
      data.period = period;
    }

    if (condition.metric.indexOf('new_') === 0) {
      data.period = '1';
    }

    e.preventDefault();
    createCondition(qualityGate.id, data).then(newCondition => {
      this.setState({ changed: false });
      onSaveCondition(condition, newCondition);
      onResetError();
    }).catch(error => onError(error));
  }

  handleUpdateClick (e) {
    const { condition, onSaveCondition, onError, onResetError } = this.props;
    const period = this.state.period;
    const data = {
      id: condition.id,
      metric: condition.metric,
      op: this.state.op,
      warning: this.state.warning,
      error: this.state.error
    };

    if (period) {
      data.period = period;
    }

    e.preventDefault();
    updateCondition(data).then(newCondition => {
      this.setState({ changed: false });
      onSaveCondition(condition, newCondition);
      onResetError();
    }).catch(error => onError(error));
  }

  handleDeleteClick (e) {
    const { qualityGate, condition, metrics, onDeleteCondition } = this.props;
    const metric = metrics.find(metric => metric.key === condition.metric);

    e.preventDefault();
    new DeleteConditionView({
      qualityGate,
      condition,
      metric,
      onDelete: () => onDeleteCondition(condition)
    }).render();
  }

  handleCancelClick (e) {
    const { condition, onDeleteCondition } = this.props;

    e.preventDefault();
    onDeleteCondition(condition);
  }

  renderPeriodValue () {
    const { condition } = this.props;
    const isLeakSelected = !!this.state.period;
    const isDiffMetric = condition.metric.indexOf('new_') === 0;

    if (isDiffMetric) {
      return (
          <span className="note">
            {translate('quality_gates.condition.leak.unconditional')}
          </span>
      );
    } else {
      return isLeakSelected ?
          translate('quality_gates.condition.leak.yes') :
          translate('quality_gates.condition.leak.no');
    }
  }

  render () {
    const { condition, edit, metrics } = this.props;
    const metric = metrics.find(metric => metric.key === condition.metric);
    const isDiffMetric = condition.metric.indexOf('new_') === 0;
    const isLeakSelected = !!this.state.period;
    const operators = ['LT', 'GT', 'EQ', 'NE'];
    const operatorOptions = operators.map(op => {
      const label = metric.type === 'RATING' ?
          translate('quality_gates.operator', op, 'rating') :
          translate('quality_gates.operator', op);
      return { label, value: op };
    });

    return (
        <tr>
          <td className="text-middle nowrap">
            {getLocalizedMetricName(metric)}
            {metric.hidden && (
                <span className="text-danger little-spacer-left">
                  {translate('deprecated')}
                </span>
            )}
          </td>

          <td className="thin text-middle nowrap">
            {(edit && !isDiffMetric) ? (
                <Checkbox
                    checked={isLeakSelected}
                    onCheck={this.handlePeriodChange.bind(this)}/>
            ) : this.renderPeriodValue()}
          </td>

          <td className="thin text-middle nowrap">
            {edit ? (
                <Select
                    ref="operator"
                    className="input-medium"
                    name="operator"
                    value={this.state.op}
                    clearable={false}
                    searchable={false}
                    options={operatorOptions}
                    onChange={this.handleOperatorChange.bind(this)}/>
            ) : translate('quality_gates.operator', condition.op)}
          </td>

          <td className="thin text-middle nowrap">
            {edit ? (
                <ThresholdInput
                    name="warning"
                    value={this.state.warning}
                    metric={metric}
                    onChange={value => this.handleWarningChange(value)}/>
            ) : formatMeasure(condition.warning, metric.type)}
          </td>

          <td className="thin text-middle nowrap">
            {edit ? (
                <ThresholdInput
                    name="error"
                    value={this.state.error}
                    metric={metric}
                    onChange={value => this.handleErrorChange(value)}/>
            ) : formatMeasure(condition.error, metric.type)}
          </td>

          {edit && (
              <td className="thin text-middle nowrap">
                {condition.id ? (
                    <div className="button-group">
                      <button
                          className="update-condition"
                          disabled={!this.state.changed}
                          onClick={this.handleUpdateClick.bind(this)}>
                        {translate('update_verb')}
                      </button>
                      <button
                          className="button-red delete-condition"
                          onClick={this.handleDeleteClick.bind(this)}>
                        {translate('delete')}
                      </button>
                    </div>
                ) : (
                    <div className="button-group">
                      <button
                          className="add-condition"
                          onClick={this.handleSaveClick.bind(this)}>
                        {translate('add_verb')}
                      </button>
                      <a
                          className="action cancel-add-condition"
                          href="#"
                          onClick={this.handleCancelClick.bind(this)}>
                        {translate('cancel')}
                      </a>
                    </div>
                )}
              </td>
          )}

        </tr>
    );
  }
}
