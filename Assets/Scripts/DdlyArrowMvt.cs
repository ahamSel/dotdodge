using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DdlyArrowMvt : MonoBehaviour
{
    public float moveSpeed;
    public float moveSign;
    Rigidbody2D rbarrow;

    // Start is called before the first frame update
    void Start()
    {
        rbarrow = GetComponent<Rigidbody2D>();
        rbarrow.velocity = transform.right * moveSign * moveSpeed;
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
