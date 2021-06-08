using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class StayBoundedMissile : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        transform.position = new Vector3(Mathf.Clamp(transform.position.x, -302.5f, 303.76f), Mathf.Clamp(transform.position.y, -152.6f, 151.8f), transform.position.z);
    }
}
