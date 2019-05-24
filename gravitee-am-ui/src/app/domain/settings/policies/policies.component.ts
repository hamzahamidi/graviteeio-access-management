/*
 * Copyright (C) 2015 The Gravitee team (http://gravitee.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Component, OnInit, ViewChild} from '@angular/core';
import {PlatformService} from "../../../services/platform.service";
import {DialogService} from "../../../services/dialog.service";
import {SnackbarService} from "../../../services/snackbar.service";
import {ActivatedRoute, Router} from "@angular/router";
import {PolicyService} from "../../../services/policy.service";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {NgForm} from "@angular/forms";

@Component({
  selector: 'app-domain-policies',
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.scss']
})
export class DomainSettingsPoliciesComponent implements OnInit {
  @ViewChild('policyForm') form: NgForm;
  private domainId: string;
  policies: any[];
  policyPlugins: any[];
  policy: any;
  policySchema: any;
  policyConfiguration: any;
  updatePolicyConfiguration: any;
  configurationIsValid: boolean = true;
  configurationPristine: boolean = true;
  extensionPoints: any = [
    {
      value: 'PRE_CONSENT',
      stage: '/PRE_CONSENT',
      expanded: true
    },
    {
      value: 'POST_CONSENT',
      stage: '/POST_CONSENT',
      expanded: false
    }
  ];

  constructor(private platformService: PlatformService,
              private policyService: PolicyService,
              private dialogService: DialogService,
              private snackbarService: SnackbarService,
              private route: ActivatedRoute,
              private router: Router) {}

  ngOnInit(): void {
    this.domainId = this.route.snapshot.parent.parent.params['domainId'];
    this.policies = this.route.snapshot.data['policies'] || {};
    this.platformService.policies().subscribe(data => this.policyPlugins = data);
  }

  addPolicy(extensionPoint, policyId) {
    this.policy = {};
    this.policy.extensionPoint = extensionPoint;
    this.policy.type = policyId;
    this.policy.enabled = true;
    this.policy.order = this.policies[extensionPoint] ? this.policies[extensionPoint].length : 0;
    this.policyConfiguration = {};
    if (this.form) {
      this.form.reset(this.policy);
    }
    this.loadPolicySchema(this.policy);
  }

  loadPolicy(event, policy) {
    event.preventDefault;
    this.policy = Object.assign({}, policy)
    this.policyConfiguration = JSON.parse(this.policy.configuration);
    this.loadPolicySchema(this.policy);
  }

  enablePolicyUpdate(configurationWrapper) {
    window.setTimeout(() => {
      this.configurationPristine = this.policy.configuration ?  (this.policy.configuration === JSON.stringify(configurationWrapper.configuration)) : Object.keys(configurationWrapper.configuration).length === 1;
      this.configurationIsValid = configurationWrapper.isValid;
      this.updatePolicyConfiguration = configurationWrapper.configuration;
    });
  }

  save() {
    this.policy.configuration = JSON.stringify(this.updatePolicyConfiguration);
    if (this.policy.id) {
      this.policyService.update(this.domainId, this.policy.id, this.policy).subscribe(data => {
        this.reloadPolicies();
        this.policy = data;
        this.policyConfiguration = JSON.parse(this.policy.configuration);
        this.snackbarService.open("Policy " + data.name + " updated");
      })
    } else {
      this.policyService.create(this.domainId, this.policy).subscribe(data => {
        this.reloadPolicies();
        this.policy = data;
        this.policyConfiguration = JSON.parse(this.policy.configuration);
        this.snackbarService.open("Policy " + data.name + " created");
      });
    }
  }

  getPolicies(extensionPoint) {
    return this.policies[extensionPoint];
  }

  drop(event: CdkDragDrop<any[]>, extensionPoint) {
    moveItemInArray(this.policies[extensionPoint], event.previousIndex, event.currentIndex);
    this.policies[extensionPoint].forEach(function (policy, i) {
      policy.order = i;
    });
    this.policyService.updateAll(this.domainId, this.policies[extensionPoint]).subscribe(() => {
      this.snackbarService.open("Policy's order changed");
    })
  }

  enablePolicy(event, policy) {
    policy.enabled = event.checked;
    this.policyService.update(this.domainId, policy.id, policy).subscribe(data => {
      this.snackbarService.open("Policy " + data.name + (policy.enabled ? ' enabled' : ' disabled'));
    });
  }

  deletePolicy(event, policy) {
    event.preventDefault();
    this.dialogService
      .confirm('Delete Policy', 'Are you sure you want to delete the policy ?')
      .subscribe(res => {
        if (res) {
          this.policyService.delete(this.domainId, policy.id).subscribe(() => {
            this.reloadPolicies();
            this.snackbarService.open("Policy deleted");
          });
        }
      });
  }

  isPolicyEnabled(policy) {
    return policy.enabled;
  }

  noPolicies(extensionPoint) {
    let policies = this.getPolicies(extensionPoint);
    return !policies || policies.length === 0;
  }

  private reloadPolicies() {
    this.policyService.findByDomain(this.domainId).subscribe(policies => this.policies = policies);
  }

  private loadPolicySchema(policy) {
    this.platformService.policySchema(policy.type).subscribe(data => {
      this.policySchema = data;
      // handle default null values
      let self = this;
      Object.keys(this.policySchema['properties']).forEach(function(key) {
        self.policySchema['properties'][key].default = '';
      });
    });
  }
}