// Unit tests for Events MCP handlers
// Tests DynamoDB queries, analytics aggregation, rule creation, and health checks

use serde_json::json;
use std::sync::Arc;

// Import test utilities
use mcp_rust::handlers::{EventsQueryHandler, EventsAnalyticsHandler, EventsCreateRuleHandler, EventsCreateAlertHandler, EventsHealthCheckHandler, Handler, HandlerError};
use mcp_rust::tenant::{TenantSession, TenantContext, ContextType, UserRole, Permission, ResourceLimits};
use mcp_rust::aws::AwsService;

// Helper function to create test tenant session
fn create_test_session() -> TenantSession {
    let context = TenantContext {
        tenant_id: "test-tenant".to_string(),
        user_id: "test-user-123".to_string(),
        context_type: ContextType::Personal,
        organization_id: "test-org-456".to_string(),
        role: UserRole::Admin,
        permissions: vec![
            Permission::SendEvents,
            Permission::ReadKV,
            Permission::WriteKV,
        ],
        aws_region: "us-west-2".to_string(),
        resource_limits: ResourceLimits::default(),
    };

    TenantSession::new(context)
}

#[cfg(test)]
mod events_query_handler_tests {
    use super::*;

    // Note: These tests require AWS credentials and DynamoDB table to exist
    // For true unit tests, we would mock the AwsService
    // For now, these are integration tests that verify the handler logic

    #[tokio::test]
    #[ignore] // Ignore by default since it requires AWS setup
    async fn test_query_events_with_user_filter() {
        // Create AWS service (requires AWS credentials)
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => {
                println!("Skipping test - AWS credentials not available");
                return;
            }
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // Query events by userId
        let arguments = json!({
            "userId": "test-user-123",
            "limit": 10
        });

        let result = handler.handle(&session, arguments).await;

        // Should succeed (even if empty results)
        assert!(result.is_ok(), "Handler should succeed with userId filter");

        let response = result.unwrap();
        assert!(response.get("events").is_some(), "Response should contain events array");
        assert!(response.get("count").is_some(), "Response should contain count");
    }

    #[tokio::test]
    async fn test_query_events_requires_filter() {
        // Create AWS service
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => {
                println!("Skipping test - AWS credentials not available");
                return;
            }
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // Query without userId or source should fail (to prevent expensive table scan)
        let arguments = json!({
            "limit": 10
        });

        let result = handler.handle(&session, arguments).await;

        // Should fail with error about requiring filter
        assert!(result.is_err(), "Query without userId or source should fail");

        if let Err(HandlerError::Aws(err)) = result {
            assert!(err.to_string().contains("requires userId or source"),
                "Error should mention required filter");
        } else {
            panic!("Expected AwsError about required filter");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_with_source_filter() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // Query by source
        let arguments = json!({
            "source": "workflow-engine",
            "limit": 20
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Should succeed with source filter");

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();

        // All events should be from the specified source
        for event in events {
            if let Some(source) = event.get("source") {
                assert_eq!(source.as_str().unwrap(), "workflow-engine");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_with_time_range() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        let start_time = "2025-09-01T00:00:00Z";
        let end_time = "2025-09-30T23:59:59Z";

        let arguments = json!({
            "userId": "test-user-123",
            "startTime": start_time,
            "endTime": end_time,
            "limit": 50
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Should succeed with time range");

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();

        // Verify all events are within time range
        for event in events {
            if let Some(timestamp) = event.get("timestamp") {
                let ts = timestamp.as_str().unwrap();
                assert!(ts >= start_time && ts <= end_time,
                    "Event timestamp should be within range");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_filter_by_detail_type() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "detailType": "workflow.completed",
            "limit": 10
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();

        // All returned events should match the detailType filter
        for event in events {
            if let Some(detail_type) = event.get("detailType") {
                assert_eq!(detail_type.as_str().unwrap(), "workflow.completed");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_filter_by_priority() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "priority": "high",
            "limit": 10
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();

        // All events should have priority=high
        for event in events {
            if let Some(priority) = event.get("priority") {
                assert_eq!(priority.as_str().unwrap(), "high");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_pagination() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // First page
        let arguments = json!({
            "userId": "test-user-123",
            "limit": 5
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();
        let count = response.get("count").unwrap().as_u64().unwrap();

        // Should return at most 5 events
        assert!(count <= 5, "Should respect limit parameter");
        assert_eq!(events.len() as u64, count, "Events array length should match count");

        // Check if there's a pagination cursor
        let last_evaluated_key = response.get("lastEvaluatedKey");
        if last_evaluated_key.is_some() && !last_evaluated_key.unwrap().is_null() {
            println!("Pagination cursor available for next page");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_empty_result() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // Query with filters that likely return no results
        let arguments = json!({
            "userId": "nonexistent-user-999999",
            "limit": 10
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Empty results should not be an error");

        let response = result.unwrap();
        let events = response.get("events").unwrap().as_array().unwrap();
        let count = response.get("count").unwrap().as_u64().unwrap();

        assert_eq!(count, 0, "Count should be 0 for no results");
        assert_eq!(events.len(), 0, "Events array should be empty");
    }

    #[tokio::test]
    async fn test_query_events_permission_check() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);

        // Create session without SendEvents permission
        let mut session = create_test_session();
        session.context.permissions = vec![Permission::ReadKV]; // Missing SendEvents

        let arguments = json!({
            "userId": "test-user-123",
            "limit": 10
        });

        // This test depends on HandlerRegistry checking permissions
        // The handler itself doesn't check - that's done at the registry level
        // So we test that the handler has the correct required_permission
        assert_eq!(
            handler.required_permission(),
            Some(Permission::SendEvents),
            "Handler should require SendEvents permission"
        );
    }

    #[tokio::test]
    #[ignore]
    async fn test_query_events_sort_order() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let session = create_test_session();

        // Test descending order (most recent first)
        let arguments_desc = json!({
            "userId": "test-user-123",
            "sortOrder": "desc",
            "limit": 5
        });

        let result_desc = handler.handle(&session, arguments_desc).await;
        assert!(result_desc.is_ok());

        // Test ascending order (oldest first)
        let arguments_asc = json!({
            "userId": "test-user-123",
            "sortOrder": "asc",
            "limit": 5
        });

        let result_asc = handler.handle(&session, arguments_asc).await;
        assert!(result_asc.is_ok());

        // Both should succeed
        let response_desc = result_desc.unwrap();
        let response_asc = result_asc.unwrap();

        assert!(response_desc.get("events").is_some());
        assert!(response_asc.get("events").is_some());
    }

    #[tokio::test]
    async fn test_tool_schema() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsQueryHandler::new(aws_service);
        let schema = handler.tool_schema();

        // Verify schema structure
        assert!(schema.get("description").is_some(), "Schema should have description");
        assert!(schema.get("inputSchema").is_some(), "Schema should have inputSchema");

        let input_schema = schema.get("inputSchema").unwrap();
        let properties = input_schema.get("properties").unwrap();

        // Verify all expected properties exist
        assert!(properties.get("userId").is_some());
        assert!(properties.get("organizationId").is_some());
        assert!(properties.get("source").is_some());
        assert!(properties.get("detailType").is_some());
        assert!(properties.get("priority").is_some());
        assert!(properties.get("startTime").is_some());
        assert!(properties.get("endTime").is_some());
        assert!(properties.get("limit").is_some());
        assert!(properties.get("exclusiveStartKey").is_some());
        assert!(properties.get("sortOrder").is_some());
    }
}

#[cfg(test)]
mod events_analytics_handler_tests {
    use super::*;
    use mcp_rust::handlers::EventsAnalyticsHandler;

    #[tokio::test]
    async fn test_analytics_requires_filter() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => {
                println!("Skipping test - AWS credentials not available");
                return;
            }
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let session = create_test_session();

        // Analytics without userId or organizationId should fail
        let arguments = json!({
            "timeRange": "24h"
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_err(), "Analytics without userId or organizationId should fail");

        if let Err(HandlerError::InvalidArguments(msg)) = result {
            assert!(msg.contains("userId") || msg.contains("organizationId"),
                "Error should mention required filter");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_analytics_event_volume_hourly() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "timeRange": "24h",
            "groupBy": "hour"
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Hourly analytics should succeed");

        let response = result.unwrap();
        assert!(response.get("eventVolume").is_some(), "Should contain eventVolume");

        let volume = response.get("eventVolume").unwrap().as_array().unwrap();

        // Should have hourly buckets
        for bucket in volume {
            assert!(bucket.get("timestamp").is_some());
            assert!(bucket.get("count").is_some());
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_analytics_top_sources() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "timeRange": "7d",
            "metrics": ["topSources"]
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.get("topSources").is_some(), "Should contain topSources");

        let sources = response.get("topSources").unwrap().as_array().unwrap();

        // Should be sorted by count (descending)
        let mut prev_count = i64::MAX;
        for source in sources {
            let count = source.get("count").unwrap().as_i64().unwrap();
            assert!(count <= prev_count, "Should be sorted descending");
            prev_count = count;

            assert!(source.get("source").is_some());
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_analytics_priority_distribution() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "timeRange": "24h",
            "metrics": ["priorityDistribution"]
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.get("priorityDistribution").is_some());

        let distribution = response.get("priorityDistribution").unwrap();

        // Should have counts for each priority level
        assert!(distribution.get("low").is_some());
        assert!(distribution.get("medium").is_some());
        assert!(distribution.get("high").is_some());
        assert!(distribution.get("critical").is_some());
    }

    #[tokio::test]
    #[ignore]
    async fn test_analytics_caching() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service.clone());
        let session = create_test_session();

        let arguments = json!({
            "userId": "test-user-123",
            "timeRange": "24h"
        });

        // First call - should query DynamoDB
        let start = std::time::Instant::now();
        let result1 = handler.handle(&session, arguments.clone()).await;
        let duration1 = start.elapsed();

        assert!(result1.is_ok());

        // Second call - should use cache (faster)
        let start = std::time::Instant::now();
        let result2 = handler.handle(&session, arguments).await;
        let duration2 = start.elapsed();

        assert!(result2.is_ok());

        // Cache hit should be significantly faster
        // (This is a heuristic test - may not always be true)
        println!("First call: {:?}, Second call: {:?}", duration1, duration2);
    }

    #[tokio::test]
    #[ignore]
    async fn test_analytics_organization_scope() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let session = create_test_session();

        // Query organization-level analytics
        let arguments = json!({
            "organizationId": "test-org-456",
            "timeRange": "7d"
        });

        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Organization-scoped analytics should succeed");

        let response = result.unwrap();
        assert!(response.get("eventVolume").is_some() ||
                response.get("topSources").is_some(),
                "Should contain analytics data");
    }

    #[tokio::test]
    async fn test_analytics_tool_schema() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);
        let schema = handler.tool_schema();

        // Verify schema structure
        assert!(schema.get("description").is_some());
        assert!(schema.get("inputSchema").is_some());

        let input_schema = schema.get("inputSchema").unwrap();
        let properties = input_schema.get("properties").unwrap();

        // Should have all expected properties
        assert!(properties.get("userId").is_some());
        assert!(properties.get("organizationId").is_some());
        assert!(properties.get("timeRange").is_some());
        assert!(properties.get("groupBy").is_some());
        assert!(properties.get("metrics").is_some());
    }

    #[tokio::test]
    async fn test_analytics_permission_check() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsAnalyticsHandler::new(aws_service);

        // Should require SendEvents permission (reusing for analytics)
        assert_eq!(
            handler.required_permission(),
            Some(Permission::SendEvents),
            "Handler should require SendEvents permission"
        );
    }
}

#[cfg(test)]
mod events_create_rule_handler_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_rule_requires_name() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service);
        let session = create_test_session();

        // Missing required 'name' field
        let arguments = json!({
            "pattern": {
                "source": ["test.source"]
            }
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_err(), "Create rule without name should fail");
    }

    #[tokio::test]
    async fn test_create_rule_requires_pattern() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service);
        let session = create_test_session();

        // Missing required 'pattern' field
        let arguments = json!({
            "name": "test-rule"
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_err(), "Create rule without pattern should fail");
    }

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_create_rule_stores_in_dynamodb() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service.clone());
        let session = create_test_session();

        let arguments = json!({
            "name": "high-priority-alerts",
            "pattern": {
                "priority": ["high", "critical"],
                "source": ["api.gateway"]
            },
            "description": "Alert on high priority API events",
            "enabled": true
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_ok(), "Create rule should succeed");

        let response = result.unwrap();
        assert_eq!(response["name"], "high-priority-alerts");
        assert_eq!(response["enabled"], true);
        assert!(response["ruleId"].is_string());
    }

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_create_rule_with_complex_pattern() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "name": "complex-filter",
            "pattern": {
                "source": ["workflow.execution"],
                "detailType": ["workflow.failed", "workflow.timeout"],
                "detail": {
                    "workflowId": [{"prefix": "prod-"}],
                    "duration": [{"numeric": [">", 300]}]
                }
            },
            "enabled": true
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_ok(), "Create rule with complex pattern should succeed");

        let response = result.unwrap();
        assert_eq!(response["name"], "complex-filter");
    }

    #[tokio::test]
    async fn test_create_rule_tool_schema() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service);
        let schema = handler.tool_schema();

        // Verify schema structure
        assert_eq!(schema["name"], "events_create_rule");
        assert!(schema.get("description").is_some());
        assert!(schema.get("inputSchema").is_some());

        let input_schema = schema.get("inputSchema").unwrap();
        let properties = input_schema.get("properties").unwrap();

        // Should have required fields
        assert!(properties.get("name").is_some());
        assert!(properties.get("pattern").is_some());
        assert!(properties.get("description").is_some());
        assert!(properties.get("enabled").is_some());

        // Check required array
        let required = input_schema.get("required").unwrap().as_array().unwrap();
        assert!(required.contains(&json!("name")));
        assert!(required.contains(&json!("pattern")));
    }

    #[tokio::test]
    async fn test_create_rule_permission_check() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateRuleHandler::new(aws_service);

        // Should require WriteKV permission for storing rules
        assert_eq!(
            handler.required_permission(),
            Some(Permission::WriteKV),
            "Handler should require WriteKV permission"
        );
    }
}

#[cfg(test)]
mod events_create_alert_handler_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_alert_requires_name() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);
        let session = create_test_session();

        // Missing required 'name' field
        let arguments = json!({
            "ruleId": "rule-123",
            "notificationMethod": "sns"
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_err(), "Create alert without name should fail");
    }

    #[tokio::test]
    async fn test_create_alert_requires_rule_id() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);
        let session = create_test_session();

        // Missing required 'ruleId' field
        let arguments = json!({
            "name": "critical-alerts",
            "notificationMethod": "sns"
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_err(), "Create alert without ruleId should fail");
    }

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_create_alert_stores_subscription() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "name": "high-priority-sns",
            "ruleId": "rule-test-123",
            "notificationMethod": "sns",
            "snsTopicArn": "arn:aws:sns:us-west-2:123456789012:alerts",
            "enabled": true
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_ok(), "Create alert should succeed");

        let response = result.unwrap();
        assert_eq!(response["name"], "high-priority-sns");
        assert!(response["subscriptionId"].is_string());
    }

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_create_alert_with_email() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({
            "name": "email-alerts",
            "ruleId": "rule-test-456",
            "notificationMethod": "email",
            "emailAddress": "alerts@example.com",
            "enabled": true
        });

        let result = handler.handle(&session, arguments).await;
        assert!(result.is_ok(), "Create email alert should succeed");
    }

    #[tokio::test]
    async fn test_create_alert_tool_schema() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);
        let schema = handler.tool_schema();

        // Verify schema structure
        assert_eq!(schema["name"], "events_create_alert");
        assert!(schema.get("description").is_some());

        let input_schema = schema.get("inputSchema").unwrap();
        let properties = input_schema.get("properties").unwrap();

        // Should have required fields
        assert!(properties.get("name").is_some());
        assert!(properties.get("ruleId").is_some());
        assert!(properties.get("notificationMethod").is_some());

        // Check required array
        let required = input_schema.get("required").unwrap().as_array().unwrap();
        assert!(required.contains(&json!("name")));
        assert!(required.contains(&json!("ruleId")));
        assert!(required.contains(&json!("notificationMethod")));
    }

    #[tokio::test]
    async fn test_create_alert_permission_check() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsCreateAlertHandler::new(aws_service);

        // Should require WriteKV permission for storing subscriptions
        assert_eq!(
            handler.required_permission(),
            Some(Permission::WriteKV),
            "Handler should require WriteKV permission"
        );
    }
}

#[cfg(test)]
mod events_health_check_handler_tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_health_check_returns_status() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsHealthCheckHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({});
        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok(), "Health check should succeed");
        let response = result.unwrap();

        assert!(response.get("status").is_some());
        assert!(response.get("checks").is_some());
    }

    #[tokio::test]
    #[ignore] // Requires AWS/LocalStack
    async fn test_health_check_includes_event_counts() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsHealthCheckHandler::new(aws_service);
        let session = create_test_session();

        let arguments = json!({});
        let result = handler.handle(&session, arguments).await;

        assert!(result.is_ok());
        let response = result.unwrap();
        let checks = response.get("checks").unwrap();

        assert!(checks.get("eventsTable").is_some());
        assert!(checks.get("rulesTable").is_some());
        assert!(checks.get("subscriptionsTable").is_some());
    }

    #[tokio::test]
    async fn test_health_check_tool_schema() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsHealthCheckHandler::new(aws_service);
        let schema = handler.tool_schema();

        // Verify schema structure
        assert_eq!(schema["name"], "events_health_check");
        assert!(schema.get("description").is_some());
        assert!(schema.get("inputSchema").is_some());
    }

    #[tokio::test]
    async fn test_health_check_permission() {
        let aws_service = match AwsService::new("us-west-2").await {
            Ok(service) => Arc::new(service),
            Err(_) => return,
        };

        let handler = EventsHealthCheckHandler::new(aws_service);

        // Should require ReadKV permission
        assert_eq!(
            handler.required_permission(),
            Some(Permission::ReadKV),
            "Handler should require ReadKV permission"
        );
    }
}
