use cc_switch_lib::SkillService;

#[path = "support.rs"]
mod support;
use support::{create_test_state, reset_test_fs, test_mutex};

#[test]
fn create_and_list_skill_groups() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    // Initially empty
    let groups = SkillService::get_skill_groups(&state.db).expect("get groups");
    assert_eq!(groups.len(), 0, "should start with no groups");

    // Create a group
    let group = SkillService::create_skill_group(&state.db, "Test Group").expect("create group");
    assert_eq!(group.name, "Test Group");
    assert!(!group.id.is_empty());

    // List should return the created group
    let groups = SkillService::get_skill_groups(&state.db).expect("get groups");
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].name, "Test Group");
    assert_eq!(groups[0].id, group.id);
}

#[test]
fn update_skill_group_name() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let group = SkillService::create_skill_group(&state.db, "Old Name").expect("create group");
    let updated =
        SkillService::update_skill_group(&state.db, &group.id, "New Name").expect("update group");

    assert_eq!(updated.name, "New Name");

    let groups = SkillService::get_skill_groups(&state.db).expect("get groups");
    assert_eq!(groups[0].name, "New Name");
}

#[test]
fn delete_empty_skill_group() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let group = SkillService::create_skill_group(&state.db, "To Delete").expect("create group");
    let deleted = SkillService::delete_skill_group(&state.db, &group.id).expect("delete group");
    assert!(deleted);

    let groups = SkillService::get_skill_groups(&state.db).expect("get groups");
    assert_eq!(groups.len(), 0);
}

#[test]
fn cannot_delete_non_empty_group() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let group = SkillService::create_skill_group(&state.db, "With Members").expect("create group");

    // Add a fake member (skill_id doesn't need to exist for this constraint check)
    SkillService::add_skill_to_group(&state.db, "skill-1", &group.id).expect("add skill");

    let result = SkillService::delete_skill_group(&state.db, &group.id);
    assert!(result.is_err(), "should fail to delete non-empty group");
}

#[test]
fn reorder_skill_groups() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let g1 = SkillService::create_skill_group(&state.db, "First").expect("create group");
    let g2 = SkillService::create_skill_group(&state.db, "Second").expect("create group");
    let g3 = SkillService::create_skill_group(&state.db, "Third").expect("create group");

    // Reverse order
    SkillService::reorder_skill_groups(&state.db, &[g3.id.clone(), g2.id.clone(), g1.id.clone()])
        .expect("reorder");

    let groups = SkillService::get_skill_groups(&state.db).expect("get groups");
    assert_eq!(groups[0].id, g3.id);
    assert_eq!(groups[1].id, g2.id);
    assert_eq!(groups[2].id, g1.id);
}

#[test]
fn add_and_remove_skill_from_group() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let group = SkillService::create_skill_group(&state.db, "My Group").expect("create group");

    SkillService::add_skill_to_group(&state.db, "skill-1", &group.id).expect("add skill");

    let members = SkillService::get_skill_group_members(&state.db).expect("get members");
    assert_eq!(members.len(), 1);
    assert_eq!(members[0].skill_id, "skill-1");
    assert_eq!(members[0].group_id, group.id);

    let removed =
        SkillService::remove_skill_from_group(&state.db, "skill-1").expect("remove skill");
    assert!(removed);

    let members = SkillService::get_skill_group_members(&state.db).expect("get members");
    assert_eq!(members.len(), 0);
}

#[test]
fn move_skill_to_group() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let state = create_test_state().expect("create test state");

    let g1 = SkillService::create_skill_group(&state.db, "Group A").expect("create group");
    let g2 = SkillService::create_skill_group(&state.db, "Group B").expect("create group");

    SkillService::add_skill_to_group(&state.db, "skill-1", &g1.id).expect("add to g1");

    // Move to g2
    SkillService::move_skill_to_group(&state.db, "skill-1", Some(&g2.id)).expect("move");

    let members = SkillService::get_skill_group_members(&state.db).expect("get members");
    assert_eq!(members.len(), 1);
    assert_eq!(members[0].group_id, g2.id);

    // Move to no group
    SkillService::move_skill_to_group(&state.db, "skill-1", None).expect("remove from group");

    let members = SkillService::get_skill_group_members(&state.db).expect("get members");
    assert_eq!(members.len(), 0);
}
