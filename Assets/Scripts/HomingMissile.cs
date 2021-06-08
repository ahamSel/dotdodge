using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class HomingMissile : MonoBehaviour
{
    private Rigidbody2D rb2dM;
    public Transform target;

    public float speed = 5f;
    public float rotateSpeed = 200f;

    // Start is called before the first frame update
    void Start()
    {
        rb2dM = GetComponent<Rigidbody2D>();
    }

    // Update is called once per frame
    void FixedUpdate()
    {
        Vector2 direction = (Vector2)target.position - rb2dM.position;

        direction.Normalize();

        float rotateAmount = Vector3.Cross(direction, transform.right).z;

        rb2dM.angularVelocity = -rotateAmount * rotateSpeed;

        rb2dM.velocity = transform.right * speed; 
    }
}
