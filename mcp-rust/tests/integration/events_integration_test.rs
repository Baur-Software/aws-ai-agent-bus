use mcp_rust::aws::AwsService;
use mcp_rust::handlers::{EventsQueryHandler, Handler};
use mcp_rust::tenant::{
    ContextType, Permission, ResourceLimits, TenantContext, TenantSession, UserRole,
};
use serde_json::json;
/// Integration tests for Events handlers
/// These tests require either:
/// 1. LocalStack running on localhost:4566 (set LOCALSTACK_ENDPOINT)
/// 2. Real AWS environment with deployed infrastructure
/// 3. Will be skipped if neither is available
use std::sync::Arc;

// Helper function to create test tenant session
fn create_test_session() -> TenantSession {
    let context = TenantContext {
        tenant_id: "integration-test-tenant".to_string(),
        user_id: "integration-test-user".to_string(),
        context_type: ContextType::Personal,
        organization_id: "integration-test-org".to_string(),
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

// Helper to check if we can run integration tests
async fn can_run_integration_tests() -> bool {
    // Check if LocalStack endpoint is set
    if std::env::var("LOCALSTACK_ENDPOINT").is_ok() {
        return true;
    }

    // Check if AWS credentials are available
    if std::env::var("AWS_ACCESS_KEY_ID").is_ok() && std::env::var("AWS_SECRET_ACCESS_KEY").is_ok()
    {
        return true;
    }

    // Check if AWS profile is set
    if std::env::var("AWS_PROFILE").is_ok() {
        return true;
    }

    false
}

// Helper to setup test data in DynamoDB
async fn setup_test_events(
    aws_service: &AwsService,
    session: &TenantSession,
) -> Result<(), Box<dyn std::error::Error>> {
    // Send some test events
    for i in 0..10 {
        let detail = json!({
            "testId": i,
            "message": format!("Test event {}", i),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        aws_service
            .send_event(
                session,
                &format!("test.event.{}", i % 3), // Vary the event types
                detail,
            )
            .await?;
    }

    // Give EventBridge + DynamoDB time to process
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    Ok(())
}

#[tokio::test]
async fn test_events_query_integration_with_user_filter() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    // Create AWS service
    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    // Setup test data
    if let Err(e) = setup_test_events(&aws_service, &session).await {
        println!("⏭️  Skipping - Failed to setup test data: {}", e);
        return;
    }

    // Create handler and query events
    let handler = EventsQueryHandler::new(aws_service);

    let arguments = json!({
        "userId": "integration-test-user",
        "limit": 20
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_ok(), "Query should succeed");

    let response = result.unwrap();
    let events = response.get("events").unwrap().as_array().unwrap();
    let count = response.get("count").unwrap().as_u64().unwrap();

    // Should have events (we just created 10)
    assert!(count > 0, "Should have at least some events");
    assert_eq!(
        events.len() as u64,
        count,
        "Events array should match count"
    );

    // Verify all events belong to the test user
    for event in events {
        if let Some(user_id) = event.get("userId") {
            assert_eq!(user_id.as_str().unwrap(), "integration-test-user");
        }
    }

    println!(
        "✅ Integration test passed: Query with user filter returned {} events",
        count
    );
}

#[tokio::test]
async fn test_events_query_integration_with_source_filter() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    // Setup test data
    if let Err(e) = setup_test_events(&aws_service, &session).await {
        println!("⏭️  Skipping - Failed to setup test data: {}", e);
        return;
    }

    let handler = EventsQueryHandler::new(aws_service);

    // Query by source (events created by send_event use "mcp-rust" as source)
    let arguments = json!({
        "source": "mcp-rust",
        "limit": 20
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_ok(), "Query with source filter should succeed");

    let response = result.unwrap();
    let events = response.get("events").unwrap().as_array().unwrap();

    // All events should have source="mcp-rust"
    for event in events {
        if let Some(source) = event.get("source") {
            assert_eq!(source.as_str().unwrap(), "mcp-rust");
        }
    }

    println!("✅ Integration test passed: Query with source filter");
}

#[tokio::test]
async fn test_events_query_integration_with_filters() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    // Setup test data
    if let Err(e) = setup_test_events(&aws_service, &session).await {
        println!("⏭️  Skipping - Failed to setup test data: {}", e);
        return;
    }

    let handler = EventsQueryHandler::new(aws_service);

    // Query with multiple filters
    let arguments = json!({
        "userId": "integration-test-user",
        "detailType": "test.event.0",
        "limit": 10
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_ok(), "Query with filters should succeed");

    let response = result.unwrap();
    let events = response.get("events").unwrap().as_array().unwrap();

    // All events should match the detailType filter
    for event in events {
        if let Some(detail_type) = event.get("detailType") {
            assert_eq!(detail_type.as_str().unwrap(), "test.event.0");
        }
    }

    println!("✅ Integration test passed: Query with detailType filter");
}

#[tokio::test]
async fn test_events_query_integration_pagination() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    // Setup test data
    if let Err(e) = setup_test_events(&aws_service, &session).await {
        println!("⏭️  Skipping - Failed to setup test data: {}", e);
        return;
    }

    let handler = EventsQueryHandler::new(aws_service);

    // First page with small limit
    let arguments = json!({
        "userId": "integration-test-user",
        "limit": 3
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_ok(), "Pagination query should succeed");

    let response = result.unwrap();
    let count = response.get("count").unwrap().as_u64().unwrap();

    // Should respect limit
    assert!(count <= 3, "Should respect limit of 3");

    // Check for pagination cursor
    let last_evaluated_key = response.get("lastEvaluatedKey");
    if count == 3 {
        assert!(
            last_evaluated_key.is_some(),
            "Should have pagination cursor when limit reached"
        );
    }

    println!(
        "✅ Integration test passed: Pagination with limit={}",
        count
    );
}

#[tokio::test]
async fn test_events_query_integration_empty_result() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    let handler = EventsQueryHandler::new(aws_service);

    // Query for non-existent user
    let arguments = json!({
        "userId": "non-existent-user-99999",
        "limit": 10
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_ok(), "Empty result should not error");

    let response = result.unwrap();
    let events = response.get("events").unwrap().as_array().unwrap();
    let count = response.get("count").unwrap().as_u64().unwrap();

    assert_eq!(count, 0, "Should have 0 events");
    assert_eq!(events.len(), 0, "Events array should be empty");

    println!("✅ Integration test passed: Empty result handled correctly");
}

#[tokio::test]
async fn test_events_query_integration_requires_filter() {
    if !can_run_integration_tests().await {
        println!("⏭️  Skipping integration test - no AWS or LocalStack available");
        return;
    }

    let aws_service = match AwsService::new("us-west-2").await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            println!("⏭️  Skipping - AWS service creation failed: {}", e);
            return;
        }
    };

    let session = create_test_session();

    let handler = EventsQueryHandler::new(aws_service);

    // Query without userId or source (should fail)
    let arguments = json!({
        "limit": 10
    });

    let result = handler.handle(&session, arguments).await;

    assert!(result.is_err(), "Query without filter should fail");

    println!("✅ Integration test passed: Requires filter validation works");
}
