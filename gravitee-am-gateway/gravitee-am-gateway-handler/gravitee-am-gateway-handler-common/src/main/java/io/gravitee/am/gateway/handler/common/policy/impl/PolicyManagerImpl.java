/**
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
package io.gravitee.am.gateway.handler.common.policy.impl;

import io.gravitee.am.gateway.core.event.PolicyEvent;
import io.gravitee.am.gateway.handler.common.auth.idp.impl.IdentityProviderManagerImpl;
import io.gravitee.am.gateway.handler.common.policy.PolicyManager;
import io.gravitee.am.gateway.policy.Policy;
import io.gravitee.am.model.Domain;
import io.gravitee.am.model.common.event.Payload;
import io.gravitee.am.plugins.policy.core.PolicyPluginManager;
import io.gravitee.am.repository.management.api.PolicyRepository;
import io.gravitee.common.event.Event;
import io.gravitee.common.event.EventListener;
import io.gravitee.common.event.EventManager;
import io.gravitee.common.service.AbstractService;
import io.reactivex.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * @author Titouan COMPIEGNE (titouan.compiegne at graviteesource.com)
 * @author GraviteeSource Team
 */
public class PolicyManagerImpl extends AbstractService implements PolicyManager, InitializingBean, EventListener<PolicyEvent, Payload> {

    private static final Logger logger = LoggerFactory.getLogger(IdentityProviderManagerImpl.class);

    @Autowired
    private Domain domain;

    @Autowired
    private PolicyRepository policyRepository;

    @Autowired
    private PolicyPluginManager policyPluginManager;

    @Autowired
    private EventManager eventManager;

    private ConcurrentMap<String, Policy> policies = new ConcurrentHashMap<>();

    @Override
    protected void doStart() throws Exception {
        super.doStart();

        logger.info("Register event listener for policy events");
        eventManager.subscribeForEvents(this, PolicyEvent.class);
    }

    @Override
    public void onEvent(Event<PolicyEvent, Payload> event) {
        if (domain.getId().equals(event.content().getDomain())) {
            switch (event.type()) {
                case DEPLOY:
                case UPDATE:
                    updatePolicy(event.content().getId(), event.type());
                    break;
                case UNDEPLOY:
                    removePolicy(event.content().getId());
                    break;
            }
        }
    }

    @Override
    public void afterPropertiesSet() {
        logger.info("Initializing policies for domain {}", domain.getName());

        policyRepository.findByDomain(domain.getId())
                .flatMapObservable(policies -> Observable.fromIterable(policies))
                .filter(io.gravitee.am.model.Policy::isEnabled)
                .toList()
                .subscribe(
                        policies1 -> {
                            policies1.forEach(policy -> updatePolicyProvider(policy));
                            logger.info("Policies loaded for domain {}", domain.getName());
                        },
                        error -> logger.error("Unable to initialize policies for domain {}", domain.getName(), error)
                );

    }

    private void updatePolicy(String policyId, PolicyEvent policyEvent) {
        final String eventType = policyEvent.toString().toLowerCase();
        logger.info("Domain {} has received {} policy event for {}", domain.getName(), eventType, policyId);
        policyRepository.findById(policyId)
                .subscribe(
                        policy -> {
                            updatePolicyProvider(policy);
                            logger.info("Policy {} {}d for domain {}", policyId, eventType, domain.getName());
                        },
                        error -> logger.error("Unable to {} policy for domain {}", eventType, domain.getName(), error),
                        () -> logger.error("No policy found with id {}", policyId));
    }

    private void removePolicy(String policyId) {
        logger.info("Domain {} has received policy event, delete policy {}", domain.getName(), policyId);
        policies.remove(policyId);
    }

    private void updatePolicyProvider(io.gravitee.am.model.Policy policy) {
        logger.info("\tInitializing policy: {} [{}]", policy.getName(), policy.getType());
        Policy policy1 = policyPluginManager.create(policy.getType(), policy.getConfiguration());
        policies.put(policy.getId(), policy1);
    }
}
